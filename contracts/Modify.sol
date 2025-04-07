pragma solidity ^0.8.29;
pragma experimental ABIEncoderV2;
import "./altbn128.sol";

contract Modify {
    // Add contract owner address
    address public owner;
    
    // Fix FTU.ERK import issue
    // Import FTU library from Reveal.sol
    struct ERK {
        uint position;    // The position in KT
        bytes32 erk_hash; // The hash value of erk stored on-chain
    }
    
    // Use custom ERK structure
    ERK[] erk;
    
    // Add onlyOwner modifier
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }
    
    // Add Be selected modifier
    modifier onlyseleted() {
        require(msg.sender == p_sel, "Caller is not the selected provider");
        _;
    }

    modifier allowed(address addr, state s){
        require(block.timestamp < timeout_round);
        require(round == s);
        require(msg.sender == addr);
        _;
    }
    
    function inState(state s) internal {
        round = s;
        timeout_round = block.timestamp + 10 minutes;
    }
    
    // Declare variables that need to be implemented in Main contract
    address public p_sel;
    uint public timeout_round;
    enum state {started, joined, ready, initiated, selected, first_delivered, delivered, revealing, revealed, not_sold, sold}
    state public round;

    uint public omega;
    
    // The number of content chunks
    uint public n;
    
    // The number of 32-byte sub-chunks in each content chunk: chunkSize / 32 (bytes32)
    uint constant chunkLength = 512;
    
    // The payment for delivery per chunk
    uint public payment_PD = 0;
    
    // The payment for providing per chunk
    uint public payment_PC = 0;

    // The payment for consumer per chunk
    uint public payment_CP = 0;

    // The number of delivered chunks
    uint public ctr = 0;

    struct ChunkData {
        uint start_chunk;
        bytes32 m1;
        bytes sigma_m1;
        address deliverer;
        bool verified;
    }

    mapping(uint => ChunkData) public sid_to_chunk_data;

    string[] meta_data;

    // The start index (1-indexed) of request content
    uint public a = 0;

    mapping(address => bool) public deliver_is_selected;    

    address[] selected_deliverers;

    function getSelectedDeliverers(uint i) public view returns (address) {
        return selected_deliverers[i];
    }

    function isSelected(address _deliveraddress) public view returns (bool) {
        return deliver_is_selected[_deliveraddress];
    }

    address[] public all_candidate_deliverers;
    
    function join_stop() public onlyOwner {
        require(round == state.started);
        require(block.timestamp < timeout_round);
        require(all_candidate_deliverers.length > 0);
        inState(state.joined);
    }
    

    address[] public prepared_candidate_deliverers;
    //
    function deliverers_prepared(string memory _urls) public {
        require(block.timestamp < timeout_round);
        require(iscandidate(msg.sender));
        meta_data.push(_urls);
        emit Debug_2(msg.sender, "is prepared");
        prepared_candidate_deliverers.push(msg.sender);
    }


    mapping(uint => uint) public sid_to_start_time;
    mapping(uint => uint) public sid_to_end_time;


    function uploadFirstChunk(uint sid, uint start_chunk, bytes32 m1, bytes memory sigma_m1) public {
        require(isSelected(msg.sender), "only selected deliverer can call this function");
        require(round == state.selected, "contract must be in selected state");
        sid_to_chunk_data[sid] = ChunkData({
            start_chunk: start_chunk,
            m1: m1,
            sigma_m1: sigma_m1,
            deliverer: msg.sender,
            verified: false
        });
        emit FirstChunkUploaded(sid, start_chunk, m1, sigma_m1, msg.sender);
    }

    // Record ledger balances for all parties
    mapping(address => uint256) public ledger;

    // Define events
    event Debug_2(address indexed sender, string message);
    event Debug_3(address indexed sender, string message);
    event Debug_4(address[] indexed sender, string message);

    event FirstChunkUploaded(
        uint indexed sid,
        uint start_chunk,
        bytes32 m1,
        bytes sigma_m1,
        address deliverer
    );

    event FirstChunkVerified(
        uint indexed sid,
        uint start_chunk,
        bytes32 m1,
        bytes sigma_m1,
        address deliverer,
        uint timestamp
    );

    event DeliveryVerified(
        uint indexed sid,
        uint i,
        uint omega,
        address deliverer,
        uint timestamp
    );
    
    function log2_alg_floor(uint _xx) pure public returns (uint) {
        uint y = 0;
        if (_xx >= 2**128) { _xx >>= 128; y += 128; }
        if (_xx >= 2**64)  { _xx >>= 64; y += 64; }
        if (_xx >= 2**32)  { _xx >>= 32; y += 32; }
        if (_xx >= 2**16)  { _xx >>= 16; y += 16; }
        if (_xx >= 2**8)   { _xx >>= 8; y += 8; }
        if (_xx >= 2**4)   { _xx >>= 4; y += 4; }
        if (_xx >= 2**2)   { _xx >>= 2; y += 2; }
        if (_xx >= 2**1)   { y += 1; }
        return y;
    }

    function validateRKeys(uint _n, uint _a, uint _ctr, uint[] memory _erk_indexes) public pure returns (bool) {
        if ((_n == _ctr) && (_erk_indexes.length == 1) && (_erk_indexes[0] == 0)) {
            // (_n == _ctr) means that the deliverer delivers all the chunks
            // (_erk_indexes.length == 1) means that the provider reveals one key
            // (_erk_indexes[0] == 0) means that the revealed key is the root key
            // which is capable of recovering all the sub-keys for chunks
            return true;
        }
        uint height = log2_alg_floor(_n);
        uint[] memory chunks_index = new uint[](_ctr);
        uint index = _n + _a - 2;
        for (uint i = 0; i < _ctr; i++) {
            chunks_index[i] = index;
            index++;
        }
        for (uint i = 0; i < _erk_indexes.length; i++){
            uint j = _erk_indexes[i];
            uint d_j = height - log2_alg_floor(j+1);
            uint l_j = j;
            uint r_j = j;
            if (d_j == 0){
                delete chunks_index[j-(_n-1)];
            } else {
                while(d_j > 0) {
                    l_j = 2 * l_j + 1;
                    r_j = 2 * r_j + 2;
                    d_j = d_j - 1;
                }
            }
            for(uint x = l_j; x <= r_j; x++){
                delete chunks_index[x-(_n-1)];
            }
        }
        // Delete will only set the value as default, and will not remove the place
        // So we need to check each position in chunks_index
        for(uint y = 0; y < _ctr; y++) {
            if (chunks_index[y] != 0) {
                return false;
            }
        }
        return true;
    }

    function iscandidate(address _deliverer_address) public view returns (bool) {
        for (uint i = 0; i < all_candidate_deliverers.length; i++) {
            if (_deliverer_address == all_candidate_deliverers[i]) {
                return true;
            }
        }
        return false;
    }
    // Add payment settlement event
    event PaymentSettled(
        address indexed deliverer,
        uint delivererPayment,
        address indexed provider,
        uint providerRefund,
        uint omega
    );
    
    // Add emitErk event
    event emitErk(uint position, BN128Curve.G1Point c_1_1, BN128Curve.G1Point c_2_1, BN128Curve.G1Point c_1_2, BN128Curve.G1Point c_2_2);
    
    // Add DisputeResolved event
    event DisputeResolved(
        address indexed provider,
        address indexed consumer,
        uint delivered_chunks,
        uint total_chunks,
        uint start_chunk
    );
}