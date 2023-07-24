import {
    CallResult,
    nat64,
    Service,
    Record,
    serviceQuery,
    serviceUpdate,
    int8
} from 'azle';

export type initPayload = Record<{
    // network: local:0 or mainnet:1
    network: int8
}>

export type Coffee = Record<{
    id: string;
    name: string;
    timestamp: nat64;
    message: string;
}>

export type CoffeePayload = Record<{
    name: string;
    message: string;
    amount: nat64
}>

export type AddressPayload = Record<{
    address: string
}>

export type Account = {
    address: string;
    balance: nat64;
};

export type State = {
    accounts: {
        [key: string]: Account;
    };
    name: string;
    ticker: string;
    totalSupply: nat64;
};


export class Token extends Service {
    @serviceUpdate
    initializeSupply: ( name: string, originalAddress: string, ticker: string,totalSupply: nat64) => CallResult<boolean>;

    @serviceUpdate
    transfer: (from: string, to: string, amount: nat64) => CallResult<boolean>;

    @serviceQuery
    balance: (id: string) => CallResult<nat64>;

    @serviceQuery
    ticker: () => CallResult<string>;

    @serviceQuery
    name: () => CallResult<string>;

    @serviceQuery
    totalSupply: () => CallResult<nat64>;
}
