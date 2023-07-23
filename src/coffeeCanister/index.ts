import { $query, $update, StableBTreeMap, Vec, Opt, match, Result, nat64, ic, Principal, int8 } from "azle";
import {
    Address,
    binaryAddressFromAddress,
    TransferFee,
    hexAddressFromPrincipal,
    Ledger,
    Tokens,
    TransferResult
} from 'azle/canisters/ledger';
import { Token, Coffee, CoffeePayload, initPayload, AddressPayload } from '../types';
import { v4 as uuidv4 } from 'uuid';

// set up with address of canister
const icpCanisterAddress: Address = ""

const tokenCanister = new Token(
    // input your token canister address
    Principal.fromText("")
);

const icpCanister = new Ledger(
    Principal.fromText(icpCanisterAddress)
);

// set up with wallet of local user 
const owner: Principal = Principal.fromText("")

const coffeeStorage = new StableBTreeMap<string, Coffee>(0, 44, 1024);

// set up variables
let initialized: boolean;
let network: int8;

// initialization function
$update
export async function initialize(payload: initPayload):  Promise<Result<string, string>>{
    if(initialized){
        ic.trap("Canister already initialized")
    }

    if (payload.network == 0){
        //set up dummyTokens
       network = 0;
       await tokenCanister.initializeSupply('ICToken', icpCanisterAddress, 'ICT', 1_000_000_000_000n).call();
    }else{
       network = 1;
    }
    return Result.Ok<string, string>("Canister Initialized");
}

$query;
export function getCoffees(): Result<Vec<Coffee>, string> {
    return Result.Ok(coffeeStorage.values());
}

$query;
export function getAddressFromPrincipal(principal: Principal): string {
    return hexAddressFromPrincipal(principal, 0);
}

$query;
export function getCoffee(id: string): Result<Coffee, string> {
    return match(coffeeStorage.get(id), {
        Some: (coffee) => Result.Ok<Coffee, string>(coffee),
        None: () => Result.Err<Coffee, string>(`coffee information with id=${id} not found`)
    });
}

$update;
export async function sendCoffee(payload: CoffeePayload): Promise<Result<Coffee, string>> {
    // check if initialized
    if(!initialized){
        ic.trap("Canister not yet initialized")
    }

    // if network is set to local network use dummy tokens
    if(network == 0){
        let status = (await tokenCanister.transfer(ic.caller().toString(), icpCanisterAddress, payload.amount).call()).Ok;   
        if(!status){
            ic.trap("Failed to Donate")
        }
    }else{
        // call mainnet function
        await depositCoffee(payload.amount);
    }
    // update storage
    const coffee: Coffee = { id: uuidv4(), timestamp: ic.time(), ...payload };
    coffeeStorage.insert(coffee.id, coffee);
    return  Result.Ok<Coffee, string>(coffee)
}

$update;
export function deleteCoffee(id: string): Result<Coffee, string> {
    return match(coffeeStorage.remove(id), {
        Some: (deletedCoffee) => Result.Ok<Coffee, string>(deletedCoffee),
        None: () => Result.Err<Coffee, string>(`couldn't delete coffee with id=${id}. message not found.`)
    });
}

// function to deposit coffee for user
async function depositCoffee(
    amount: nat64,
): Promise<Result<TransferResult, string>> {
    const balance = (await getAccountBalance(ic.caller().toText())).Ok?.e8s;
    const transfer_fee = (await getTransferFee()).Ok?.transfer_fee.e8s

    if(balance !== undefined && balance > amount){
        return await icpCanister
            .transfer({
                memo: 0n,
                amount: {
                    e8s: amount
                },
                fee: {
                    e8s: transfer_fee? transfer_fee : 10000n 
                },
                from_subaccount: Opt.None,
                to: binaryAddressFromAddress(icpCanisterAddress),
                created_at_time: Opt.None
            })
            .call();
    } else{
        ic.trap("Fund your account first")
    }
}

// function to withdraw funds from coffee canister
$update;
export async function withdrawFunds(
    to: Address,
    amount: nat64,
): Promise<Result<string, string>> {
    if(ic.caller() !== owner){
        ic.trap("Only owner can withdraw funds")
    }

    if(network == 0){
        let status = (await tokenCanister.transfer(icpCanisterAddress, ic.caller.toString(), amount).call()).Ok;   
        if(!status){
            ic.trap("Failed to Donate")
        }
        return Result.Ok<string, string>("Successful")
    }else{
        const balance = (await getAccountBalance(icpCanisterAddress)).Ok?.e8s;
        const transfer_fee = (await getTransferFee()).Ok?.transfer_fee.e8s;
    
        if(balance !== undefined && balance > amount){
            let result = await icpCanister
            .transfer({
                memo: 0n,
                amount: {
                    e8s: amount
                },
                fee: {
                    e8s: transfer_fee? transfer_fee : 10000n 
                },
                from_subaccount: Opt.None,
                to: binaryAddressFromAddress(to),
                created_at_time: Opt.None
            })
            .call();

            if (result.Ok){
                return Result.Ok<string, string>("Successful")
            }else{
                return Result.Err<string, string>(result.Err)
            }
        }else{
            ic.trap("Fund your account first")
        }
    }
}

// function to get main-net account balance
async function getAccountBalance(
    address: Address
): Promise<Result<Tokens, string>> {
    return await icpCanister
        .account_balance({
            account: binaryAddressFromAddress(address)
        })
        .call();
}

// get transfer fee for mainnet
async function getTransferFee(): Promise<Result<TransferFee, string>> {
    return await icpCanister.transfer_fee({}).call();
}

// Helper functions
// function to get faucet tokens
$update
export async function getFaucetTokens(): Promise<Result<boolean, string>>{
    const caller = ic.caller();
    const returnVal = (await tokenCanister.balance(caller.toString()).call()).Ok;
    const balance = returnVal? returnVal : 0n;
    if(balance > 0n){
        ic.trap("To prevent faucet drain, please utilize your existing tokens");
    }
    return await tokenCanister.transfer(icpCanisterAddress, caller.toString(), 100n).call();   
}

// function to get balance from token canister
$update;
export async function walletBalanceLocal(payload: AddressPayload): Promise<Result<nat64, string>> {
    let address = payload.address
    if(address == ""){
        address = ic.caller().toString();
    }
    return await tokenCanister.balance(address).call();
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    //@ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
};