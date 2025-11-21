export interface Result<T> {
    tag: 'ok';
    val: T;
}

export interface Error {
    tag: 'err';
    val: string;
}

export type ResultString = Result<string> | Error;
export type ResultBool = Result<boolean> | Error;
export type ResultList = Result<string[]> | Error;
export type ResultBytes = Result<Uint8Array> | Error;

export interface ClientInstance {
    css: {
        initialize: () => ResultString;
        load: (content: string, id?: string) => ResultString;
        unload: (id: string) => ResultBool;
        clearAll: () => ResultString;
        list: () => ResultList;
    };
    screen: {
        capture: (selector?: string) => ResultBytes;
    };
    execute: (script: string, args?: string) => ResultString;
}

export const client: {
    connect: (host: string, port: number) =>
        | { tag: 'ok', val: ClientInstance }
        | { tag: 'err', val: string };
};
