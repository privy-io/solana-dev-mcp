import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl, SystemProgram, Transaction, sendAndConfirmTransaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PrivyClient } from "@privy-io/server-auth";
import 'dotenv/config';

// Create an MCP server
const server = new McpServer({
    name: "Solana RPC Tools",
    version: "1.0.0",
});

// Load variables from .env
const PRIVY_APP_ID = process.env.PRIVY_APP_ID as string;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET as string;
const PRIVY_WALLET_ID = process.env.PRIVY_WALLET_ID as string;
const PRIVY_WALLET_ADDRESS = process.env.PRIVY_WALLET_ADDRESS as string;
const CLUSTER_URL = process.env.SOLANA_CLUSTER_URL as string;
const CLUSTER_NAME = process.env.SOLANA_CLUSTER_NAME as string;

// Initialize Solana connection based on the provided Cluster URL
const connection = new Connection(CLUSTER_URL);
// Determine the CAIP-2 ID for the Solana network. Defaults to 'mainnet-beta' if 'devnet' is not specified. 
const CAIP2 = CLUSTER_NAME === 'devnet' ? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';


// Initialize Privy SDK
const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

// Solana RPC Methods as Tools
// Get Account Info
server.tool(
    "getAccountInfo",
    "Used to look up account info by public key (32 byte base58 encoded address)",
    { publicKey: z.string() },
    async ({ publicKey }) => {
        try {
            const pubkey = new PublicKey(publicKey);
            const accountInfo = await connection.getAccountInfo(pubkey);
            return {
                content: [{ type: "text", text: JSON.stringify(accountInfo, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${(error as Error).message}` }]
            };
        }
    }
);

// Send SOL to another address
server.tool(
    "transferSOL",
    "Used send a transaction from a Solana wallet address to another Solana address",
    { recipient: z.string(), amount: z.number() },
    async ({ recipient, amount }) => {
        try {
            const amountInLamports = amount * LAMPORTS_PER_SOL;

            const senderKeypair = new PublicKey(PRIVY_WALLET_ADDRESS);
            const recipientKeypair = new PublicKey(recipient);
            
            const transferInstruction = SystemProgram.transfer({
                fromPubkey: senderKeypair,
                toPubkey: recipientKeypair,
                lamports: amountInLamports,
            });
            const {blockhash} = await connection.getLatestBlockhash();
    
            const messageV0 = new TransactionMessage({
                payerKey: senderKeypair,
                recentBlockhash: blockhash,
                instructions: [transferInstruction],
            }).compileToV0Message();
            const transaction = new VersionedTransaction(messageV0);

            const {hash} = await privy.walletApi.solana.signAndSendTransaction({
                walletId: PRIVY_WALLET_ID,
                caip2: CAIP2, 
                transaction,
            });
              
            return {
                content: [{ type: "text", text: `Sent transaction. Check it out at https://explorer.solana.com/tx/${hash}?cluster=devnet` }]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${(error as Error).message}` }]
            };
        }
    }
);

// Get Balance
server.tool(
    "getBalance",
    "Used to look up balance by public key (32 byte base58 encoded address)",
    { publicKey: z.string() },
    async ({ publicKey }) => {
        try {
            const pubkey = new PublicKey(publicKey);
            const balance = await connection.getBalance(pubkey);
            return {
                content: [{ type: "text", text: `${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)` }]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${(error as Error).message}` }]
            };
        }
    }
);

// Get Minimum Balance For Rent Exemption
server.tool(
    "getMinimumBalanceForRentExemption",
    "Used to look up minimum balance required for rent exemption by data size",
    { dataSize: z.number() },
    async ({ dataSize }) => {
        try {
            const minBalance = await connection.getMinimumBalanceForRentExemption(dataSize);
            return {
                content: [{ type: "text", text: `${minBalance / LAMPORTS_PER_SOL} SOL (${minBalance} lamports)` }]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${(error as Error).message}` }]
            };
        }
    }
);

// Get Transaction
server.tool("getTransaction",
    "Used to look up transaction by signature (64 byte base58 encoded string)",
    { signature: z.string() },
    async ({ signature }) => {
        try {
            const transaction = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
            return {
                content: [{ type: "text", text: JSON.stringify(transaction, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${(error as Error).message}` }]
            };
        }
    }
);

// Add a dynamic account info resource
// Setup specific resources to read from solana.com/docs pages
server.resource(
    "solanaDocsInstallation",
    new ResourceTemplate("solana://docs/intro/installation", { list: undefined }),
    async (uri) => {
        try {
            const response = await fetch(`https://raw.githubusercontent.com/solana-foundation/solana-com/main/content/docs/intro/installation.mdx`);
            const fileContent = await response.text();
            return {
                contents: [{
                    uri: uri.href,
                    text: fileContent
                }]
            };
        } catch (error) {
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error: ${(error as Error).message}`
                }]
            };
        }
    }
);

server.resource(
    "solanaDocsClusters",
    new ResourceTemplate("solana://docs/references/clusters", { list: undefined }),
    async (uri) => {
        try {
            const response = await fetch(`https://raw.githubusercontent.com/solana-foundation/solana-com/main/content/docs/references/clusters.mdx`);
            const fileContent = await response.text();
            return {
                contents: [{
                    uri: uri.href,
                    text: fileContent
                }]
            };
        } catch (error) {
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error: ${(error as Error).message}`
                }]
            };
        }
    }
);

server.prompt(
    'calculate-storage-deposit',
    'Calculate storage deposit for a specified number of bytes',
    { bytes: z.string() },
    ({ bytes }) => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: `Calculate the SOL amount needed to store ${bytes} bytes of data on Solana using getMinimumBalanceForRentExemption.`
            }
        }]
    })
);

server.prompt(
    'minimum-amount-of-sol-for-storage',
    'Calculate the minimum amount of SOL needed for storing 0 bytes on-chain',
    () => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: `Calculate the amount of SOL needed to store 0 bytes of data on Solana using getMinimumBalanceForRentExemption & present it to the user as the minimum cost for storing any data on Solana.`
            }
        }]
    })
);

server.prompt(
    'why-did-my-transaction-fail',
    'Look up the given transaction and inspect its logs to figure out why it failed',
    { signature: z.string() },
    ({ signature }) => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: `Look up the transaction with signature ${signature} and inspect its logs to figure out why it failed.`
            }
        }]
    })
);

server.prompt(
    'how-much-did-this-transaction-cost',
    'Fetch the transaction by signature, and break down cost & priority fees',
    { signature: z.string() },
    ({ signature }) => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: `Calculate the network fee for the transaction with signature ${signature} by fetching it and inspecting the 'fee' field in 'meta'. Base fee is 0.000005 sol per signature (also provided as array at the end). So priority fee is fee - (numSignatures * 0.000005). Please provide the base fee and the priority fee.`
            }
        }]
    })
);

server.prompt('what-happened-in-transaction',
    'Look up the given transaction and inspect its logs & instructions to figure out what happened',
    { signature: z.string() },
    ({ signature }) => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: `Look up the transaction with signature ${signature} and inspect its logs & instructions to figure out what happened.`
            }
        }]
    })
);


// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport);