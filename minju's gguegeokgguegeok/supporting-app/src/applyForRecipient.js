'use strict';

var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');

var fabric_client = new Fabric_Client();

//console.log("submit recording of a tuna catch: ");
console.log("submit recording of a applied recipient data: ");

var array = req.params.supporter.split("-");
/*
var key = array[0]
var timestamp = array[2]
var location = array[1]
var vessel = array[4]
var holder = array[3]
*/
var key = array[0]
var name = array[1]
var id = array[2]
var email = array[3]
var password = array[4]
var address = array[5]
var phoneNum = array[6]
var story = array[7]
var status = array[8]

var fabric_client = new Fabric_Client();

// setup the fabric network
/*var channel = fabric_client.newChannel('channel');
var peer = fabric_client.newPeer('grpc://localhost:7051');
channel.addPeer(peer);
var order = fabric_client.newOrderer('grpc://localhost:7050')
channel.addOrderer(order);
*/
// 채널1으로 테스트
// setup the fabric network
var mychannel1 = fabric_client.newChannel('mychannel1');
var peer0 = fabric_client.newPeer('grpc://localhost:17051');
var peer1 = fabric_client.newPeer('grpc://localhost:18051');
var peer2 = fabric_client.newPeer('grpc://localhost:27051');
var peer3 = fabric_client.newPeer('grpc://localhost:28051');
var peer4 = fabric_client.newPeer('grpc://localhost:37051');
var peer5 = fabric_client.newPeer('grpc://localhost:38051');
var peer6 = fabric_client.newPeer('grpc://localhost:47051');
var peer7 = fabric_client.newPeer('grpc://localhost:48051');
mychannel1.addPeer(peer0);
mychannel1.addPeer(peer1);
mychannel1.addPeer(peer2);
mychannel1.addPeer(peer3);
mychannel1.addPeer(peer4);
mychannel1.addPeer(peer5);
mychannel1.addPeer(peer6);
mychannel1.addPeer(peer7);


var order = fabric_client.newOrderer('grpc://localhost:7050')
mychannel1.addOrderer(order);

var member_user = null;
var store_path = path.join(os.homedir(), '.hfc-key-store');
console.log('Store path:'+store_path);
var tx_id = null;

// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
Fabric_Client.newDefaultKeyValueStore({ path: store_path
}).then((state_store) => {
    // assign the store to the fabric client
    fabric_client.setStateStore(state_store);
    var crypto_suite = Fabric_Client.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);

    // get the enrolled user from persistence, this user will sign all requests
    return fabric_client.getUserContext('user1', true);
}).then((user_from_store) => {
    if (user_from_store && user_from_store.isEnrolled()) {
        console.log('Successfully loaded user1 from persistence');
        member_user = user_from_store;
    } else {
        throw new Error('Failed to get user1.... run registerUser.js');
    }

    // get a transaction id object based on the current user assigned to fabric client
    tx_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", tx_id._transaction_id);

    // recordTuna - requires 5 args, ID, vessel, location, timestamp,holder - ex: args: ['10', 'Hound', '-12.021, 28.012', '1504054225', 'Hansel'], 
    // send proposal to endorser
    /*const request = {
        //targets : --- letting this default to the peers assigned to the channel
        chaincodeId: 'tuna-app',
        fcn: 'recordTuna',
        args: [key, vessel, location, timestamp, holder],
        chainId: 'mychannel',
        txId: tx_id
    };*/
    const request = {
        //targets : --- letting this default to the peers assigned to the channel
        chaincodeId: 'supporting-app',
        fcn: 'applyForRecipient',
        args: [key, name, id, email, password, address, phoneNum, story, status],
        chainId: 'mychannel1',
        txId: tx_id
    };

    // send the transaction proposal to the peers
    return mychannel1.sendTransactionProposal(request);
}).then((results) => {
    var proposalResponses = results[0];
    var proposal = results[1];
    let isProposalGood = false;
    if (proposalResponses && proposalResponses[0].response &&
        proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
        } else {
            console.error('Transaction proposal was bad');
        }
    if (isProposalGood) {
        console.log(util.format(
            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
            proposalResponses[0].response.status, proposalResponses[0].response.message));

        // build up the request for the orderer to have the transaction committed
        var request = {
            proposalResponses: proposalResponses,
            proposal: proposal
        };

        // set the transaction listener and set a timeout of 30 sec
        // if the transaction did not get committed within the timeout period,
        // report a TIMEOUT status
        var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
        var promises = [];

        var sendPromise = mychannel1.sendTransaction(request);
        promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

        // get an eventhub once the fabric client has a user assigned. The user
        // is required bacause the event registration must be signed
        let event_hub = fabric_client.newEventHub();
        event_hub.setPeerAddr('grpc://localhost:17053');
        event_hub.setPeerAddr('grpc://localhost:18053');
        event_hub.setPeerAddr('grpc://localhost:27053');
        event_hub.setPeerAddr('grpc://localhost:28053');
        // using resolve the promise so that result status may be processed
        // under the then clause rather than having the catch clause process
        // the status
        let txPromise = new Promise((resolve, reject) => {
            let handle = setTimeout(() => {
                event_hub.disconnect();
                resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
            }, 10000);
            event_hub.connect();
            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                // this is the callback for transaction event status
                // first some clean up of event listener
                clearTimeout(handle);
                event_hub.unregisterTxEvent(transaction_id_string);
                event_hub.disconnect();

                // now let the application know what happened
                var return_status = {event_status : code, tx_id : transaction_id_string};
                if (code !== 'VALID') {
                    console.error('The transaction was invalid, code = ' + code);
                    resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                } else {
                    console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                    resolve(return_status);
                }
            }, (err) => {
                //this is the callback if something goes wrong with the event registration or processing
                reject(new Error('There was a problem with the eventhub ::'+err));
            });
        });
        promises.push(txPromise);

        return Promise.all(promises);
    } else {
        console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
    }
}).then((results) => {
    console.log('Send transaction promise and event listener promise have completed');
    // check the results in the order the promises were added to the promise all list
    if (results && results[0] && results[0].status === 'SUCCESS') {
        console.log('Successfully sent transaction to the orderer.');
        res.send(tx_id.getTransactionID());
    } else {
        console.error('Failed to order the transaction. Error code: ' + response.status);
    }

    if(results && results[1] && results[1].event_status === 'VALID') {
        console.log('Successfully committed the change to the ledger by the peer');
        res.send(tx_id.getTransactionID());
    } else {
        console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
    }
}).catch((err) => {
    console.error('Failed to invoke successfully :: ' + err);
});