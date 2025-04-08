// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;
pragma experimental ABIEncoderV2;

import "./Utility.sol";
import "./altbn128.sol";
import "./Provider.sol";
import "./Deliverer.sol";
import "./Consumer.sol";
import "./Content.sol";
import "./Modify.sol";

contract Main is Modify {
    address payable public provider;
    address payable public deliverer_d;
    address payable public consumer;
    address[] public global_deliverers;
    uint public k;
    mapping(address => uint) public candidate_deliverers_bid;    

    mapping(address => uint) public AddtoPaymentdp;
    uint public timeout_delivered;
    uint public timeout_dispute;
    uint public time_delivered;
    uint public end_time;
    address public globalContractAddress;
    Provider public providerContract;
    Deliverer public delivererContract;
    Consumer public consumerContract;
    Content public contentContract;
    
    address payable public FTPContractAddress;
    bytes32 public root_m;
    BN128Curve.G1Point public vpk_consumer;
    
    UTI public utiContract;
    
    constructor(address _globalProviderAddress, address _globalDelivererAddress, address _globalConsumerAddress, address _globalContentAddress) payable {
        owner = msg.sender;
        timeout_round = block.timestamp;
        providerContract = Provider(_globalProviderAddress);
        delivererContract = Deliverer(_globalDelivererAddress);
        consumerContract = Consumer(_globalConsumerAddress);
        contentContract = Content(_globalContentAddress);
        utiContract = new UTI();
    }
    
    function start(address _pka, bytes32 _root_m, uint _n, uint _payment_PD, uint _payment_PC) payable public {
        require(_payment_PD > 0 && _payment_PC > 0);
        require(msg.value >= _payment_PD*_n);
        require(round == state.started);
        providerContract.initializeProvider(_pka);
        providerContract.setPayment(_pka, _payment_PD, _payment_PC);
        payment_PD = _payment_PD;
        payment_PC = _payment_PC;

        // store the payment of provider in the ledger
        ledger[_pka] = msg.value;
        // ledger[_pka] = ledger[_pka] - _n * _payment_PD;

        root_m = _root_m;
        n = _n;
        provider = payable(_pka);
        inState(state.started);
    }
    
    function join(uint _bid) public {
        require(round == state.started);
        require(block.timestamp < timeout_round);
        global_deliverers = delivererContract.getDelivererAddress();
        all_candidate_deliverers.push(msg.sender);
        candidate_deliverers_bid[msg.sender] = _bid;
        bool flag = false;
        for (uint i = 0; i < global_deliverers.length; i++) {
            if (msg.sender == global_deliverers[i]) {
                flag = true;
                break;
            }
        }
        if (!flag) {
            delivererContract.newDeliverer(msg.sender);
        }
    }

    function prepared() public onlyOwner {
        require(round == state.joined);
        address[] memory provider_list = contentContract.getProvidersByContentHash(root_m);
        bool flag = false;
        for (uint i = 0; i < provider_list.length; i++) {
            if (msg.sender == provider_list[i]) {
                flag = true;
                break;
            }
        }
        if (!flag) {
            contentContract.addProviderToContentHash(root_m, msg.sender);
            providerContract.incrementContentTypes(msg.sender);
            providerContract.addProviderContent(msg.sender, root_m, payment_PD, meta_data);
        }
        inState(state.ready);
    }

    function consume(address pk_c, uint _Payment_CP, uint _a, bytes32 _root_m) payable public {
        require(round == state.ready, "contract state must be ready");
        require(_a >= 1 && _a <= n, "request start index must be in valid range");
        payment_CP = _Payment_CP;
        require(msg.value >= (n - _a + 1) * payment_CP, "payment amount is not enough");
        a = _a;                        
        consumer = payable(msg.sender); 
        address[] memory p_list = contentContract.getProvidersByContentHash(_root_m);   
        require(p_list.length > 0, "no providers found for this content");
        Provider.ProviderInfo[] memory p_can = new Provider.ProviderInfo[](p_list.length);
        for (uint i = 0; i < p_list.length; i++) {
            p_can[i] = providerContract.getProviderInfo(p_list[i]);
            require(p_can[i].provider_address != address(0), "invalid provider address");
        }
        p_sel = providerContract.OPS(p_can, payment_CP);
        require(p_sel != address(0), "no suitable provider found");
        ledger[consumer] = msg.value;
        // ledger[consumer] = ledger[consumer] - (n - _a + 1) * payment_CP;
        timeout_delivered = block.timestamp + 10 minutes;
        inState(state.initiated);
        emit Debug_2(p_sel, "consume selected a provider");
    }

    function initiate() public onlyOwner {
        require(round == state.ready);
        require(block.timestamp < timeout_round);
        inState(state.initiated);   
    }

    function select(address[] memory _deliverers, uint[] memory _B_dp) public onlyOwner {
        require(round == state.initiated);
        require(block.timestamp < timeout_round);
        k = _deliverers.length;
        for(uint i = 0; i < _deliverers.length; i++) {
            selected_deliverers.push(_deliverers[i]);
            AddtoPaymentdp[_deliverers[i]] = _B_dp[i];
        }
        delete all_candidate_deliverers;
        delete prepared_candidate_deliverers;
        for(uint i = 0; i < selected_deliverers.length; i++) {
            deliver_is_selected[selected_deliverers[i]] = true;
        }
        inState(state.selected);
    }

    function verifyFirstChunk(uint sid) public {
        require(msg.sender == consumer, "only consumer can call this function");
        require(round == state.selected, "contract must be in selected state");
        require(sid_to_chunk_data[sid].deliverer != address(0), "no data found for this sid");
        require(!sid_to_chunk_data[sid].verified, "data already verified");
        ChunkData storage data = sid_to_chunk_data[sid];
        bytes32 message = keccak256(abi.encodePacked(sid, data.start_chunk, data.m1));
        bytes32 prefixedMessage = utiContract.prefixed(message);
        address signer = utiContract.recoverSigner(prefixedMessage, data.sigma_m1);
        require(signer == data.deliverer, "invalid signature");
        data.verified = true;
        sid_to_start_time[sid] = block.timestamp;
        a = data.start_chunk;
        emit FirstChunkVerified(sid, data.start_chunk, data.m1, data.sigma_m1, data.deliverer, block.timestamp);
        inState(state.first_delivered);
    }

    function delivered() public  {
        require(round == state.first_delivered);
        inState(state.delivered);   
    }

    function verifyPoDQProof(uint sid, uint i, bytes memory sigma_i) public {
        require(isSelected(msg.sender), "only selected deliverer can call this function");
        require(round == state.delivered, "contract must be in first_delivered state");
        require(i >= a && i <= n, "chunk index must be in valid range");
        require(sid_to_start_time[sid] > 0, "no corresponding sid start time found");
        ChunkData storage data = sid_to_chunk_data[sid];
        require(data.deliverer != address(0), "no chunk data found for this sid");
        require(data.deliverer == msg.sender, "only the deliverer who uploaded the first chunk can verify delivery");
        bytes32 message = keccak256(abi.encodePacked(sid, "receipt", i, msg.sender, consumer));
        bytes32 prefixedMessage = utiContract.prefixed(message);
        address signer = utiContract.recoverSigner(prefixedMessage, sigma_i);
        require(signer == consumer, "signature must be from consumer");
        sid_to_end_time[sid] = block.timestamp;
        ctr = i - a + 1;
        time_delivered = sid_to_start_time[sid];
        end_time = sid_to_end_time[sid];
        delivererContract.updateDelivererStats(
            msg.sender,
            ctr,
            chunkLength,
            sid_to_start_time[sid],
            sid_to_end_time[sid]
        );
        uint Payment_DP = AddtoPaymentdp[msg.sender];
        
        uint deliveryPayment = ctr * Payment_DP;
        require(address(this).balance >= deliveryPayment, "Insufficient contract balance");

        ledger[provider] -= deliveryPayment;

        payable(msg.sender).transfer(deliveryPayment);
        emit DeliveryVerified(sid, i, ctr, msg.sender, block.timestamp);
        emit PaymentSettled(
            msg.sender,
            deliveryPayment,
            provider,
            (ctr < n) ? (n - ctr) * Payment_DP : 0,
            ctr
        );
        inState(state.revealing);
    }

    function revealKeys(uint[] memory _positions, BN128Curve.G1Point[] memory _c_1s, BN128Curve.G1Point[] memory _c_2s) allowed(provider, state.revealing) public {
        assert((_c_1s.length == _c_2s.length) && (_c_1s.length == 2 * _positions.length));
        bytes32 erk_hash = "";
        for (uint i = 0; i < _positions.length; i++) {
            emit emitErk(_positions[i], _c_1s[2*i], _c_2s[2*i], _c_1s[2*i+1], _c_2s[2*i+1]);
            erk_hash = keccak256(abi.encodePacked(erk_hash, _c_1s[2*i].X, _c_1s[2*i].Y, _c_2s[2*i].X, _c_2s[2*i].Y, _c_1s[2*i+1].X, _c_1s[2*i+1].Y, _c_2s[2*i+1].X, _c_2s[2*i+1].Y));
            erk.push(ERK(_positions[i], erk_hash));
        }
        timeout_dispute = block.timestamp + 20 minutes;
        inState(state.revealed);
    }

    function disputeTO() public {
        // require(block.timestamp >= timeout_dispute, "Dispute timeout not reached yet");
        require(round == state.revealed, "Contract not in revealed state");
        
        // use SafeMath or ensure all calculations use the same type
        uint256 providerPayment = ctr * payment_PC;

        
        ledger[provider] += providerPayment;
        ledger[consumer] -= providerPayment;
        
        require(address(this).balance >= ledger[provider] + ledger[consumer], "Insufficient contract balance");
        
        if (ledger[provider] > 0) {
            uint256 providerAmount = ledger[provider];
            ledger[provider] = 0; // clear the ledger balance
            payable(provider).transfer(providerAmount);
        }
        
        if (ledger[consumer] > 0) {
            uint256 consumerAmount = ledger[consumer];
            ledger[consumer] = 0; // clear the ledger balance
            payable(consumer).transfer(consumerAmount);
        }
        
        providerContract.incrementProviderStats(provider, selected_deliverers.length);
        consumerContract.incrementConsumerStats(consumer);
        
        inState(state.sold);
        
        emit DisputeResolved(provider, consumer, ctr, n, a);
    }

    // Below is about dispute resolution
    function wrongRK() allowed(consumer, state.revealed) public {
        require(block.timestamp < timeout_dispute);
        uint[] memory erk_indexes = new uint[](erk.length);
        for (uint i = 0; i < erk.length; i++) {
            erk_indexes[i] = erk[i].position;
        }
        if (!utiContract.validateRKeys(n, a, ctr, erk_indexes)) {
            uint256 providerPayment = ctr * payment_PC;
            payable(msg.sender).transfer(providerPayment);
            ledger[msg.sender] -= providerPayment;
            providerContract.incrementMisbehave(provider);
            inState(state.not_sold);
            emit DisputeResolved(provider, consumer, ctr, n, a);
        } else {
            consumerContract.incrementMisbehave(consumer);
        }
    }

    function PoM(
        uint[] memory _i_j_steps, 
        bytes32[] memory _c_i, 
        bytes memory _signature_i_P, 
        bytes32 _m_i_hash, 
        UTI.MerkleProof[] memory _merkleProof, 
        UTI.SubmittedERK[] memory _st_erk, 
        UTI.SubmittedRK[] memory _st_rk, 
        UTI.VPKEProof[] memory _vpke_proof
    ) allowed(consumer, state.revealed) public {
        require(block.timestamp < timeout_dispute);
        if (!utiContract.validatePoM(
            _i_j_steps, 
            _c_i, 
            _signature_i_P, 
            _m_i_hash, 
            _merkleProof, 
            _st_erk, 
            erk, 
            _st_rk, 
            _vpke_proof, 
            n, 
            ctr, 
            root_m, 
            vpk_consumer, 
            provider
        )) {
            ledger[consumer] += (n - a + 1 - ctr) * payment_PC;
            providerContract.incrementMisbehave(provider);
            inState(state.not_sold);
            emit DisputeResolved(provider, consumer, ctr, n, a);
        } else {
            consumerContract.incrementMisbehave(consumer);
        }
    }

    // function reset() public onlyOwner {
    //     
    //     address originalProvider = provider;
    //     address originalConsumer = consumer;
        
    //     
    //     delete global_deliverers;
    //     delete all_candidate_deliverers;
    //     delete prepared_candidate_deliverers;
    //     delete selected_deliverers;
    //     delete erk;
        
    //     
    //     ledger[originalProvider] = 0;
    //     ledger[originalConsumer] = 0;
        
    //     
    //     provider = payable(address(0));
    //     deliverer_d = payable(address(0));
    //     consumer = payable(address(0));
    //     k = 0;
    //     timeout_delivered = 0;
    //     timeout_dispute = 0;
    //     time_delivered = 0;
    //     end_time = 0;
    //     root_m = bytes32(0);
    //     vpk_consumer = BN128Curve.G1Point(0, 0);
        
    //     
    //     inState(state.sold);
    // }
}