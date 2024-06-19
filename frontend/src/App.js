import React, { useState, useEffect } from 'react';
import { PublicKey, clusterApiUrl, Connection } from '@solana/web3.js'; // Import necessary modules from Solana Web3.js
import './App.css';
import idl from './idl.json';
import { Program, AnchorProvider, web3, utils, BN } from '@project-serum/anchor';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

// Define the network to connect to (devnet for development, mainnet-beta for production)
const network = clusterApiUrl('devnet');

// Define the program id (public key of the deployed smart contract)
const programId = new PublicKey(idl.metadata.address);

console.log('The program id of the smart contract is: ', programId.toString());

// Define the default provider options
const opts = {
    preflightCommitment: 'processed',
};

const { SystemProgram } = web3;

const App = () => {
    // State to hold the connected wallet's address
    const [walletAddress, setWalletAddress] = useState(null);

    // State to hold the list of campaigns
    const [campaigns, setCampaigns] = useState([]);

    // Function to connect to the Phantom wallet
    const connectWallet = async () => {
        // Check if the Solana object is injected in the window by the wallet (like Phantom)
        if (window.solana) {
            try {
                // Request wallet connection
                const response = await window.solana.connect();
                // Set the wallet address in the state
                setWalletAddress(response.publicKey.toString());
                console.log('Connected with Public Key:', response.publicKey.toString());
            } catch (err) {
                // Log any error that occurs during the connection process
                console.error('Wallet connection error:', err);
            }
        } else {
            // Alert the user if no Solana wallet is found
            alert('Solana wallet not found! Get a Phantom Wallet 👻');
        }
    };

    // Function to create a provider
    const getProvider = () => {
        const connection = new Connection(network, opts.preflightCommitment);
        const provider = new AnchorProvider(
            connection, window.solana, opts.preflightCommitment
        );
        return provider;
    };

    // Function to retrieve a list of campaigns
    const getCampaigns = async () => {
        const connection = new Connection(network, opts.preflightCommitment);
        const provider = getProvider();

        console.log('The get provider is: ', provider.wallet.publicKey.toString());

        const program = new Program(idl, programId, provider);

        console.log('The program id is: ', program.idl.metadata.address);
        Promise.all(
            (await connection.getProgramAccounts(programId)).map(
                async (campaign) => ({
                    ...(await program.account.campaign.fetch(campaign.pubkey)),
                    pubkey: campaign.pubkey,
                })
            )
        ).then((campaigns) => {
            setCampaigns(campaigns);
            console.log('Campaigns are: ', campaigns);
        })
        .catch(error => {
            console.log(error);
        });
    };

    // Function to create a new campaign
    const createCampaign = async () => {
        try {
            const provider = getProvider();
            console.log('The provider is: ', provider.wallet.publicKey.toString());

            console.log('The idl address', idl.metadata.address);

            const program = new Program(idl, programId, provider);

            console.log('The program public key: ', program.idl.instructions);

            const [campaign] = await PublicKey.findProgramAddress(
                [
                    utils.bytes.utf8.encode('CAMPAIGN_DEMO'),
                    provider.wallet.publicKey.toBuffer(),
                ],
                program.programId
            );

            console.log('Program address found: ', campaign);

            await program.rpc.create('campaign name', 'campaign description', {
                accounts: {
                    campaign,
                    user: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            });

            console.log('Created a new campaign w/ address: ', campaign.toString());
        } catch (error) {
            console.log('Error creating campaign account: ', error);
        }
    };

    // Automatically connect to the wallet if Phantom is already connected and trusted
    useEffect(() => {
        if (window.solana && window.solana.isPhantom) {
            window.solana.connect({ onlyIfTrusted: true })
                .then(({ publicKey }) => {
                    console.log('Connected with the public key: ', publicKey.toString());
                    // Set the wallet address in the state
                    setWalletAddress(publicKey.toString());
                })
                .catch((err) => {
                    // Log any error that occurs during the auto-connect process
                    console.error('Auto-connect error:', err);
                });
        }
    }, []); // Empty dependency array ensures this runs only once on component mount

    // Function to disconnect from the Phantom wallet
    const disconnectWallet = () => {
        // Reset the wallet address in the state to null
        setWalletAddress(null);
        console.log('Disconnected');
    };

    // Function to render the UI if wallet is not connected
    const renderNotConnectedContainer = () => (
        <button onClick={connectWallet}>Connect to Wallet</button>
    );

    const renderConnectedContainer = () => (
        <>
            <div>
                <h1>Solana Wallet Address</h1>
                <h2>Wallet Address: {walletAddress}</h2>
                <button onClick={createCampaign}>Create a campaign…</button>
                <button onClick={disconnectWallet}>Disconnect wallet</button>
                <button onClick={getCampaigns}>Get a list of campaigns…</button>
                <br />
            </div>

            {campaigns.map((campaign) => (
                <div key={campaign.pubkey.toString()}>
                    <p>Campaign ID: {campaign.pubkey.toString()}</p>
                    <p>
                        Balance:{" "}
                        {(campaign.amountDonated / web3.LAMPORTS_PER_SOL).toString()}
                    </p>
                    <p>{campaign.name}</p>
                    <p>{campaign.description}</p>
                    <button onClick={() => donate(campaign.pubkey)}>Click to donate!</button>
                    <button onClick={() => withdraw(campaign.pubkey)}>Click to withdraw!</button>
                    <br />
                </div>
            ))}
        </>
    );

    const donate = async (publicKey) => {
        try {
            const provider = getProvider();
            const program = new Program(idl, programId, provider);

            await program.rpc.donate(new BN(0.2 * web3.LAMPORTS_PER_SOL), {
                accounts: {
                    campaign: publicKey,
                    user: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            });
            console.log('Donated some money to:', publicKey.toString());
            getCampaigns();
        } catch (error) {
            console.error('Error donating:', error);
        }
    };

    const withdraw = async (publicKey) => {
        try {
            const provider = getProvider();
            const program = new Program(idl, programId, provider);

            await program.rpc.withdraw(new BN(0.2 * web3.LAMPORTS_PER_SOL), {
                accounts: {
                    campaign: publicKey,
                    user: provider.wallet.publicKey,
                },
            });
            console.log('Withdrew some money from:', publicKey.toString());
        } catch (error) {
            console.error('Error withdrawing:', error);
        }
    };

    // Render the main component
    return (
        <div className="App">
            {!walletAddress && renderNotConnectedContainer()}
            {walletAddress && renderConnectedContainer()}
        </div>
    );
};

export default App;
