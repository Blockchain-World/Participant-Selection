// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./altbn128.sol";
import "./Modify.sol";

contract UTI {

    struct ERK {
        uint position; // The position in KT
        bytes32 erk_hash; // The hash value of erk stored on-chain
    }
    
    struct SubmittedERK {
        uint position; // The position index in KT
        uint C1_X;   // C1.X
        uint C1_Y;   // C1.Y
        uint C2_X;   // C2.X
        uint C2_Y;   // C2.Y
    }
    
    struct SubmittedRK {
        uint position; // The position in KT
        bytes32 value; // The submitted rk value
    }
    
    struct VPKEProof {
        uint position; // The position is the index in KT
        uint A_X; // A.X on BN128Curve
        uint A_Y; // A.Y on BN128Curve
        uint B_X; // B.X on BN128Curve
        uint B_Y; // B.Y on BN128Curve
        uint Z;   // Z
    }
    
    struct MerkleProof {
        bytes32 label; // The hash value of the sibling
        uint posIden; // The binary bit indicating the position
    }
    
    // Functions for signature verification
    function splitSignature(bytes memory sig) public pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65);
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }
    
    function recoverSigner(bytes32 message, bytes memory sig) public pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
        return ecrecover(message, v, r, s);
    }
    
    function prefixed(bytes32 hash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

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
    
    function validateRKeys(
        uint _n,           // Total number of chunks
        uint _a,           // Starting chunk index
        uint _ctr,         // Number of delivered chunks
        uint[] memory _erk_indexes  // Array of encryption key indices
    ) public pure returns (bool) {
        // Special case: if all chunks are delivered and there is only one root key
        if ((_n == _ctr) && (_erk_indexes.length == 1) && (_erk_indexes[0] == 0)) {
            return true;
        }

        // Calculate tree height
        uint height = log2_alg_floor(_n);
        
        // Create array of chunk indices to verify
        uint[] memory chunks_index = new uint[](_ctr);
        uint index = _n + _a - 2;
        for (uint i = 0; i < _ctr; i++) {
            chunks_index[i] = index;
            index++;
        }

        // Verify if each erk can cover corresponding chunks
        for (uint i = 0; i < _erk_indexes.length; i++) {
            uint j = _erk_indexes[i];
            uint d_j = height - log2_alg_floor(j+1);
            uint l_j = j;
            uint r_j = j;
            
            if (d_j == 0) {
                delete chunks_index[j-(_n-1)];
            } else {
                while(d_j > 0) {
                    l_j = 2 * l_j + 1;
                    r_j = 2 * r_j + 2;
                    d_j = d_j - 1;
                }
                
                for(uint x = l_j; x <= r_j; x++) {
                    if (x-(_n-1) < _ctr) {
                        delete chunks_index[x-(_n-1)];
                    }
                }
            }
        }

        // Check if all chunks are covered
        for(uint y = 0; y < _ctr; y++) {
            if (chunks_index[y] != 0) {
                return false;
            }
        }
        return true;
    }
    
    function compute_nizk_challenge(BN128Curve.G1Point memory _A, BN128Curve.G1Point memory _B, BN128Curve.G1Point memory _c_1, BN128Curve.G1Point memory _c_2, bytes32 _rk_i, BN128Curve.G1Point memory vpk_consumer) public view returns (uint) {
        bytes32 g_hash = keccak256(abi.encodePacked(BN128Curve.P1().X, BN128Curve.P1().Y));
        bytes32 A_hash = keccak256(abi.encodePacked(_A.X, _A.Y));
        bytes32 B_hash = keccak256(abi.encodePacked(_B.X, _B.Y));
        bytes32 vpk_hash = keccak256(abi.encodePacked(vpk_consumer.X, vpk_consumer.Y));
        bytes32 c_1_hash = keccak256(abi.encodePacked(_c_1.X, _c_1.Y));
        bytes32 c_2_hash = keccak256(abi.encodePacked(_c_2.X, _c_2.Y));
        return uint(keccak256(abi.encodePacked(g_hash, A_hash, B_hash, vpk_hash, c_1_hash, c_2_hash, _rk_i)));
    }
    
    function validateSig(uint _i, bytes32[] memory _c_i, bytes memory _signature_i_P, address provider) public pure returns (bool) {
        bytes32 h = "";
        for (uint j = 0; j < _c_i.length; j++) {
            h = keccak256(abi.encodePacked(h, _c_i[j]));
        }
        bytes32 invalid_chunk = prefixed(keccak256(abi.encodePacked(_i, provider, h)));
        if (recoverSigner(invalid_chunk, _signature_i_P) == provider) {
            return true;
        } else {
            return false;
        }
    }
    
    function vrfyMTP(MerkleProof[] memory _merkleProof, bytes32 _m_i_hash, bytes32 root_m) public pure returns (bool) {
        bytes32 hash_temp = _m_i_hash;
        for (uint i = 0; i < _merkleProof.length; i++){
            if (_merkleProof[i].posIden == 0){
                hash_temp = keccak256(abi.encodePacked(hash_temp, _merkleProof[i].label));
            }
            if (_merkleProof[i].posIden == 1){
                hash_temp = keccak256(abi.encodePacked(_merkleProof[i].label, hash_temp));
            }
        }
        return (hash_temp == root_m);
    }
    
    function validatePoM(
        uint[] memory _i_j_steps,          
        bytes32[] memory _c_i,             
        bytes memory _signature_i_P,       
        bytes32 _m_i_hash,                
        MerkleProof[] memory _merkleProof, 
        SubmittedERK[] memory _st_erk,     
        Modify.ERK[] memory _erk,          // Using Modify.ERK type
        SubmittedRK[] memory _st_rk,       
        VPKEProof[] memory _vpke_proof,    
        uint n,                            
        uint ctr,                          
        bytes32 root_m,                    
        BN128Curve.G1Point memory vpk_consumer,
        address provider                    
    ) public view returns (bool) {
        // 1. Verify if erk index is within valid range
        if (_i_j_steps[1] >= 0 && _i_j_steps[1] < _erk.length) {
            // 2. Verify Provider signature
            if (validateSig(_i_j_steps[0], _c_i, _signature_i_P, provider)) {
                // 3. Verify Merkle tree proof
                if (vrfyMTP(_merkleProof, _m_i_hash, root_m)) {
                    // 4. Verify ERK consistency
                    bytes32 computed_erk_hash = "";
                    for (uint i = 0; i < 2; i++) {
                        computed_erk_hash = keccak256(abi.encodePacked(
                            computed_erk_hash,
                            _st_erk[i].C1_X, _st_erk[i].C1_Y,
                            _st_erk[i].C2_X, _st_erk[i].C2_Y
                        ));
                    }
                    
                    // 5. Check if submitted ERK hash matches the one stored on-chain
                    if (computed_erk_hash == _erk[_i_j_steps[1]].erk_hash) {
                        // 6. Verify VPKE proof
                        for (uint i = 0; i < 2; i++) {
                            uint challenge = compute_nizk_challenge(
                                BN128Curve.G1Point(_vpke_proof[i].A_X, _vpke_proof[i].A_Y),
                                BN128Curve.G1Point(_vpke_proof[i].B_X, _vpke_proof[i].B_Y),
                                BN128Curve.G1Point(_st_erk[i].C1_X, _st_erk[i].C1_Y),
                                BN128Curve.G1Point(_st_erk[i].C2_X, _st_erk[i].C2_Y),
                                _st_rk[i].value,
                                vpk_consumer
                            );
                            
                            // If VPKE proof verification fails, return true (indicating misbehavior found)
                            if (challenge != _vpke_proof[i].Z) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
}