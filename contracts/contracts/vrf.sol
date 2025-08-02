// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VrfRequester is VRFConsumerBaseV2Plus {
    // --- Chainlink VRF Configuration (For Ethereum) ---
    bytes32 public immutable keyHash;
    uint256 public immutable subId;
    uint32 public callbackGasLimit;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;

    address public trustedRelayer;
    mapping(uint256 => uint256) public vrfRequestToGameId;

    event RandomnessFulfilled(uint256 indexed gameId, uint256 indexed requestId, uint256[] randomWords);

/* 
vrf 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B
hash 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae
sub id 5243944830507222263561864829778792646440869080144669439996439558722982792511
 */


    constructor(
        address vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subId,
        address _initialOwner
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        transferOwnership(_initialOwner);

        keyHash = _keyHash;
        subId = _subId;
        callbackGasLimit = 200_000;
        trustedRelayer = _initialOwner;
    }

    function requestRandomness(uint256 gameId) external {
        require(msg.sender == trustedRelayer, "Only the trusted relayer can call this");

        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subId,
            requestConfirmations: REQUEST_CONFIRMATIONS,
            callbackGasLimit: callbackGasLimit,
            numWords: NUM_WORDS,
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