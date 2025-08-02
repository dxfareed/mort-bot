// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VrfRequester is VRFConsumerBaseV2Plus {
    bytes32 public immutable keyHash;
    uint256 public immutable subId;
    uint32 public callbackGasLimit;
    address public trustedRelayer;
    
    mapping(uint256 => uint256) public vrfRequestToGameId;

    event RandomnessFulfilled(uint256 indexed gameId, uint256 indexed requestId, uint256[] randomWords);

    constructor(
        address vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subId,
        address _admin
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        keyHash = _keyHash;
        subId = _subId;
        callbackGasLimit = 200_000;
        trustedRelayer = _admin; 
    }

    function requestRandomness(uint256 gameId) external {
        require(msg.sender == trustedRelayer, "Only the trusted relayer can call this");
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subId,
            requestConfirmations: 3,
            callbackGasLimit: callbackGasLimit,
            numWords: 1,
            extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
        });
        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);
        vrfRequestToGameId[requestId] = gameId;
    }
    
    function requestRanmiNumbers(uint256 gameId) external {
        require(msg.sender == trustedRelayer, "Only the trusted relayer can call this");
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subId,
            requestConfirmations: 3,
            callbackGasLimit: 300_000,
            numWords: 6,
            extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
        });
        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);
        vrfRequestToGameId[requestId] = gameId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 gameId = vrfRequestToGameId[requestId];
        require(gameId != 0, "Request not found or already fulfilled");
        delete vrfRequestToGameId[requestId];
        emit RandomnessFulfilled(gameId, requestId, randomWords);
    }
    
    
    function setTrustedRelayer(address _newRelayer) external onlyOwner {
        trustedRelayer = _newRelayer;
    }

    function setCallbackGasLimit(uint32 _newLimit) external onlyOwner {
        callbackGasLimit = _newLimit;
    }
}
