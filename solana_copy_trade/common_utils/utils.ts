export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const logger = {
    info: (message: string) => console.log(`INFO: ${message}`),
    error: (message: string) => console.error(`ERROR: ${message}`),
};

export function shortenAddress(address: string) {
    const firstPart = address.slice(0, 6);
    const lastPart = address.slice(-4);
    return `${firstPart}...${lastPart}`;
}

export function isNumber(inputText: string | undefined) {
    if (!inputText)
        return false;
    return !isNaN(parseFloat(inputText)) && isFinite(Number(inputText));
}