const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Initialize variables to store initial balances
let initialProviderBalance;
let initialConsumerBalance;
let initialDelivererBalance;

describe("P2PCDN System Test", function () {
  // Define a fixture to reuse the same setup
  async function deployP2PCDNFixture() {
    console.log("Starting contract deployment...");
    
    // Get test accounts
    const [owner, provider1, deliverer1, deliverer2, consumer1] = await ethers.getSigners();
    console.log("Test accounts prepared:");
    console.log("- Owner address:", owner.address);
    console.log("- Provider address:", provider1.address);
    console.log("- Deliverer1 address:", deliverer1.address);
    console.log("- Deliverer2 address:", deliverer2.address);
    console.log("- Consumer address:", consumer1.address);
    
    // Record initial balances - Convert fixed values to BigNumber
    initialProviderBalance = ethers.parseEther("10000");
    initialConsumerBalance = ethers.parseEther("10000");
    initialDelivererBalance = ethers.parseEther("10000");
    
    console.log("\nInitial balances before deployment:");
    console.log("- Provider initial balance:", ethers.formatEther(initialProviderBalance), "ETH");
    console.log("- Consumer initial balance:", ethers.formatEther(initialConsumerBalance), "ETH");
    console.log("- Deliverer initial balance:", ethers.formatEther(initialDelivererBalance), "ETH");
    
    // Owner deploys global contracts
    console.log("\nOwner deploying global contracts...");
    const Provider = await ethers.getContractFactory("Provider", owner);
    const providerContract = await Provider.deploy();
    await providerContract.waitForDeployment();
    console.log("Provider contract deployed:", await providerContract.getAddress());
    
    const Deliverer = await ethers.getContractFactory("Deliverer", owner);
    const delivererContract = await Deliverer.deploy();
    await delivererContract.waitForDeployment();
    console.log("Deliverer contract deployed:", await delivererContract.getAddress());
    
    const Consumer = await ethers.getContractFactory("Consumer", owner);
    const consumerContract = await Consumer.deploy();
    await consumerContract.waitForDeployment();
    console.log("Consumer contract deployed:", await consumerContract.getAddress());
    
    const Content = await ethers.getContractFactory("Content", owner);
    const contentContract = await Content.deploy();
    await contentContract.waitForDeployment();
    console.log("Content contract deployed:", await contentContract.getAddress());
    
    // Provider deploys Main contract
    console.log("\nProvider deploying Main contract...");
    const Main = await ethers.getContractFactory("Main", provider1);
    const mainContract = await Main.deploy(
      await providerContract.getAddress(),
      await delivererContract.getAddress(),
      await consumerContract.getAddress(),
      await contentContract.getAddress()
    );
    await mainContract.waitForDeployment();
    console.log("Main contract deployed:", await mainContract.getAddress());
    
    return { 
      providerContract, 
      delivererContract, 
      consumerContract, 
      contentContract, 
      mainContract, 
      owner, 
      provider1, 
      deliverer1, 
      deliverer2,
      consumer1 
    };
  }

  describe("Basic Flow Test", function () {
    it("Should complete content provision and distribution process", async function () {
      const { 
        providerContract, 
        delivererContract, 
        consumerContract, 
        contentContract, 
        mainContract, 
        owner, 
        provider1, 
        deliverer1,
        deliverer2,
        consumer1
      } = await loadFixture(deployP2PCDNFixture);
      
      console.log("\nStarting basic flow test...");
      
      // Test data
      const contentHash = "0xcfd941c14535fc004b1668d312cdd472ac4df0903724ae1fcd544e924300033e";
      const contentChunks = 8;
      const paymentPD = ethers.parseEther("20"); // Payment for deliverer
      const paymentPC = ethers.parseEther("200"); // Payment for consumer
      
      console.log("Test data prepared:");
      console.log("- Content hash root_m:", contentHash);
      console.log("- Content chunks n:", contentChunks);
      console.log("- Deliverer payment Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("- Consumer payment Payment_PC:", ethers.formatEther(paymentPC), "ETH");
      
      // Check Main contract's initial state at test start
      const initialRound = await mainContract.round();
      console.log("Initial state:", initialRound);
      // If initial state is not started (0), may need to set state
      if (initialRound.toString() !== "0") {
        console.log("Warning: Contract not in started state");
      }
      
      const startTx = await mainContract.connect(provider1).start(
        provider1.address,
        contentHash,
        contentChunks,
        paymentPD,
        paymentPC,
        { value: paymentPD * BigInt(contentChunks) }
      );
      const resp = await startTx.wait();

      // Get Main contract's ETH balance
      const mainContractBalance = await ethers.provider.getBalance(await mainContract.getAddress());
      // Get Provider contract's ETH balance
      const ledgerpk_provider1 = await mainContract.connect(provider1).ledger(provider1.address);

      console.log("\nStep 1: Provider start process");
      console.log("----------------------------------------------------------------------");
      console.log("Provider start call Start method, parameters as follows:");
      console.log("Provider address:", provider1.address);
      console.log("Content hash root_m:", contentHash);
      console.log("Content chunks n:", contentChunks);
      console.log("Deliverer payment Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("Consumer payment Payment_PC:", ethers.formatEther(paymentPC), "ETH");
      console.log("Enter contract amount:", ethers.formatEther(paymentPD * BigInt(contentChunks+2)), "ETH");
      console.log("Execution result status:", resp.status === 1 ? "✅ start method transaction execution succeeded!" : "❌ start transaction execution failed!");
      console.log("Main contract ETH balance:", ethers.formatEther(mainContractBalance), "ETH");
      console.log("ledger[pk_provider1] balance amount:", ethers.formatEther(ledgerpk_provider1), "ETH");
      console.log("----------------------------------------------------------------------\n");
      


      // 2. Deliverer1 join
      console.log("\nStep 2.1: deliverer1 call join method");
      console.log("----------------------------------------------------------------------");
      // deliverer1's payment can be lower than the highest price set by Provider
      const deliverer2Bid = ethers.parseEther("9"); // deliverer2's payment
      const deliverer1Bid = ethers.parseEther("8"); // deliverer1's payment
            // deliverer1 join
            const joinTx1 = await mainContract.connect(deliverer1).join(deliverer1Bid);
      const resp1 = await joinTx1.wait();
            
            // deliverer2 join
            const joinTx2 = await mainContract.connect(deliverer2).join(deliverer2Bid);
            const resp2 =     await joinTx2.wait();

      console.log("Deliverer1 start call Join method, parameters as follows:");
      console.log("Deliverer1 address:", deliverer1.address);
      console.log("Deliverer1 payment Payment_DP:", ethers.formatEther(deliverer1Bid), "ETH");
      console.log("Provider highest acceptable payment Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("Execution result status:", resp1.status === 1 ? "✅ join method execution succeeded!" : "❌ join transaction execution failed!");

      // Add code to check Deliverer initialization information
      console.log("\nCheck Deliverer initialization information:");
      try {
        // Get all Deliverer addresses
        const allDeliverers = await delivererContract.getDelivererAddress();
        console.log("All Deliverer addresses:", allDeliverers);
        
        // Check if deliverer1 is in the list
        const isDeliverer1InList = allDeliverers.includes(deliverer1.address);
        console.log("Is deliverer1 in Deliverer list:", isDeliverer1InList);
        
        if (isDeliverer1InList) {
          // Get deliverer1's credibility value
          const cred = await delivererContract.GetMyCred(deliverer1.address);
          console.log("deliverer1's credibility value:", cred.toString());
          
          // Get deliverer1's evaluation information
          const eval = await delivererContract.GetMyEval(deliverer1.address);
          console.log("deliverer1's evaluation information:");
          console.log("- Number of services provided:", eval.delivery_nums.toString());
          console.log("- Total amount:", eval.total_amount.toString());
          console.log("- Average speed:", eval.avg_speed.toString());
        } else {
          console.log("❌ deliverer1 not correctly initialized!");
        }
      } catch (error) {
        console.log("Error checking Deliverer initialization information:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");
      
      // 2.1. Deliverer2 join
      console.log("\nStep 2.2: deliverer2 call join method");
      console.log("----------------------------------------------------------------------");
      // deliverer2's payment can be different from deliverer1

      console.log("Deliverer2 start call Join method, parameters as follows:");
      console.log("Deliverer2 address:", deliverer2.address);
      console.log("Deliverer2 payment Payment_PD:", ethers.formatEther(deliverer2Bid), "ETH");
      console.log("Provider highest acceptable payment Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("Execution result status:", resp2.status === 1 ? "✅ join method execution succeeded!" : "❌ join transaction execution failed!");
            // Check if deliverer is already joined
      const isCandidate1 = await mainContract.iscandidate(deliverer1.address);
      console.log("Is deliverer1 a candidate:", isCandidate1);
            
      const isCandidate2 = await mainContract.iscandidate(deliverer2.address);
      console.log("Is deliverer2 a candidate:", isCandidate2);
      console.log("----------------------------------------------------------------------\n\n");
      

      

      
      // 3. Stop join phase
      console.log("Step 3: Stop join phase (manual stop, otherwise wait timePass)");
      console.log("----------------------------------------------------------------------");
      console.log("Provider send Content to all Candidate deliverer");
      // Since provider1 is the deployer of the Main contract, it should be owner
      const joinStopTx = await mainContract.connect(provider1).join_stop();
      await joinStopTx.wait();
      console.log("Join phase stopped");
      const resp3 = await joinStopTx.wait();
      console.log("Execution result status:", resp3.status === 1 ? "✅ join_stop method execution succeeded!" : "❌ join_stop transaction execution failed!");
      console.log("----------------------------------------------------------------------\n");
      
      
      
      // 4. deliverer ready
      console.log("\nStep 4: deliverer1/deliverer2 call deliverers_prepared method");
      console.log("----------------------------------------------------------------------");
      console.log("Deliverers receive Content and reply Provider ready");
      const url1 = "https://example.com/content1";
      const url2 = "https://example.com/content2";

      const prepared1Tx = await mainContract.connect(deliverer1).deliverers_prepared(url1);
      await prepared1Tx.wait();
      console.log("deliverer1 ready, provide URL:", url1);

      const prepared2Tx = await mainContract.connect(deliverer2).deliverers_prepared(url2);
      await prepared2Tx.wait();
      console.log("deliverer2 ready, provide URL:", url2);

      // Check ready
      console.log("Check chain ready_candidate_deliverers array data:");
      

      try {
        // Try to get array length
        let length = 0;
        let preparedDeliverers = [];
        
        // Loop to try to get array elements until failure
        while (true) {
          try {
            const address = await mainContract.prepared_candidate_deliverers(length);
            preparedDeliverers.push(address);
            length++;
          } catch (e) {
            // When index out of range, throw error, exit loop
            break;
          }
        }
        
        console.log("ready_candidate_deliverers array length:", length);
        console.log("ready_candidate_deliverers array content:", preparedDeliverers);
        
        // Check if specific address is in the array
        const isPrepared1 = preparedDeliverers.includes(deliverer1.address);
        const isPrepared2 = preparedDeliverers.includes(deliverer2.address);
        
        console.log("deliverer1 address:", deliverer1.address);
        console.log("Is deliverer1 in ready list:", isPrepared1);
        console.log("deliverer2 address:", deliverer2.address);
        console.log("Is deliverer2 in ready list:", isPrepared2);
              // Get ready deliverer count
        const preparedCount = preparedDeliverers.length;
        console.log("Ready deliverer count:", preparedCount.toString());
        
      } catch (error) {
        console.log("Error querying ready_candidate_deliverers array:", error.message);
      }
      
      console.log("----------------------------------------------------------------------\n");

      
      // 5. Provider ready
      console.log("\nStep 5: Provider ready");
      console.log("----------------------------------------------------------------------");
      // Check Main contract's owner
      const contractOwner = await mainContract.owner();
      console.log("Contract owner:", contractOwner);
      // Use correct account to call ready
      const ownerPreparedTx = await mainContract.connect(
        contractOwner === provider1.address ? provider1 : owner
      ).ready();
      await ownerPreparedTx.wait();
      console.log("Provider confirmed ready completion");

      // Immediately check ready() execution status
      console.log("\nReady completion contract status:");
      try {
        // Get current contract status
        const currentState = await mainContract.round();
        console.log("Current contract status:", currentState.toString());
        
        // Check if ready state is entered
        if (currentState.toString() === "2") { // ready state corresponding enum value
          console.log("✅ Contract successfully entered ready state");
        } else {
          console.log("❌ Contract not entered ready state, current status:", currentState.toString());
        }
        
        // Expand global contract data check part
        console.log("\nGlobal contract data check:");
        
        // 1. Check Content contract data
        console.log("\n1. Content contract data check:");
        try {
          const providersForContent = await contentContract.getProvidersByContentHash(contentHash);
          console.log("Content contract provides this content Provider list:", providersForContent);
          console.log("Is Provider added to content hash mapping:", providersForContent.includes(provider1.address));
          
          // Try to get more content related information
          console.log("Try to get all content hash...");
          try {
          } catch (e) {
            console.log("Cannot get all content hash:", e.message);
          }
        } catch (error) {
          console.log("Error checking Content contract data:", error.message);
        }
        
        
        // 3. Check Deliverer contract data
        console.log("\n3. Deliverer contract data check:");
        try {
          // Get all Deliverer addresses
          const allDeliverers = await delivererContract.getDelivererAddress();
          console.log("All Deliverer addresses:", allDeliverers);
          
          // Check if deliverer1 and deliverer2 are in the list
          console.log("Is deliverer1 in Deliverer list:", allDeliverers.includes(deliverer1.address));
          console.log("Is deliverer2 in Deliverer list:", allDeliverers.includes(deliverer2.address));
          
          // Try to get Deliverer information
          if (allDeliverers.includes(deliverer1.address)) {
            try {
              // Use correct method to get Deliverer information
              const deliverer1Cred = await delivererContract.GetMyCred(deliverer1.address);
              const deliverer1Eval = await delivererContract.GetMyEval(deliverer1.address);
              
              console.log("deliverer1 information:");
              console.log("- Credibility value:", deliverer1Cred.toString());
              console.log("- Number of services provided:", deliverer1Eval.delivery_nums.toString());
              console.log("- Total amount:", deliverer1Eval.total_amount.toString());
              console.log("- Average speed:", deliverer1Eval.avg_speed.toString());
            } catch (e) {
              console.log("Cannot get deliverer1 information:", e.message);
            }
          }
        } catch (error) {
          console.log("Error checking Deliverer contract data:", error.message);
        }
        

        try {
          // Try to get consumer information
          try {
          } catch (e) {
            console.log("Cannot get Consumer information or Consumer not registered:", e.message);
          }
        } catch (error) {
          console.log("Error checking Consumer contract data:", error.message);
        }
        
        // 5. Check Main contract data
        console.log("\n5. Main contract data check:");
        try {
          // Get basic information from Main contract
          const rootM = await mainContract.root_m();
          const n = await mainContract.n();
          const paymentPD = await mainContract.payment_PD();
          const paymentPC = await mainContract.payment_PC();
          const round = await mainContract.round();
          
          console.log("Content hash root_m:", rootM);
          console.log("Content chunks n:", n.toString());
          console.log("Deliverer payment payment_PD:", ethers.formatEther(paymentPD), "ETH");
          console.log("Consumer payment payment_PC:", ethers.formatEther(paymentPC), "ETH");
          console.log("Current round status round:", round.toString());
          
          // Get candidate Deliverer information
          console.log("\nCandidate Deliverer information:");
          let allCandidateCount = 0;
          let allCandidates = [];
          
          try {
            while (true) {
              const candidate = await mainContract.all_candidate_deliverers(allCandidateCount);
              allCandidates.push(candidate);
              allCandidateCount++;
            }
          } catch (e) {
            // Index out of range, end loop
          }
          
          console.log("Candidate Deliverer count:", allCandidateCount);
          console.log("Candidate Deliverer list:", allCandidates);
          
          // Get ready candidate Deliverer information
          console.log("\nReady candidate Deliverer information:");
          let preparedCount = 0;
          let preparedCandidates = [];
          
          try {
            while (true) {
              const prepared = await mainContract.prepared_candidate_deliverers(preparedCount);
              preparedCandidates.push(prepared);
              preparedCount++;
            }
          } catch (e) {
            // Index out of range, end loop
          }
          
          console.log("Ready candidate Deliverer count:", preparedCount);
          console.log("Ready candidate Deliverer list:", preparedCandidates);
          
        } catch (error) {
          console.log("Error checking Main contract data:", error.message);
        }
        
      } catch (error) {
        console.log("Error checking ready() execution status:", error.message);
      }
      console.log("----------------------------------------------------------------------\n");

      
      // 6. Verify content added to Provider
      console.log("\nStep 6: Verify content added to Provider");
      console.log("----------------------------------------------------------------------\n");
      // Check Main contract's owner
      const providerList = await contentContract.getProvidersByContentHash(contentHash);
      console.log("Content Provider list:", providerList);
      
      // Check if Provider is in the list
      const providerInList = providerList.includes(provider1.address);
      console.log("Is deliverer1 in ready_candidate_deliverers array:", providerInList);
      console.log("----------------------------------------------------------------------\n");
      // Check Main contract's owner
      // 7. Check Provider content type count
      console.log("\nStep 7: Check Provider content type count");
      console.log("----------------------------------------------------------------------\n");
      const providerInfo = await providerContract.GetMyEval(provider1.address);
      console.log("Provider content type count:", providerInfo.content_types.toString());
 
      // 8. Test OPS function through consume method
      console.log("\nStep 8: Test OPS function through consume method");
      console.log("----------------------------------------------------------------------");
      console.log("Create multiple Providers and call consume method to test OPS function selection logic");
      
      // Get all Providers providing this content
      const providersForContent = await contentContract.getProvidersByContentHash(contentHash);
      console.log("Current providing content Provider list:", providersForContent);
      
      // Create an additional Provider for testing
      console.log("\nAdd an additional Provider for testing...");
      
      // Use owner as an additional Provider
      const additionalProvider = owner;
      console.log("Additional Provider address:", additionalProvider.address);
      
      // Initialize additional Provider
      await providerContract.initializeProvider(additionalProvider.address);
      
      // Set additional Provider's credibility value and price
      await providerContract.GetSelectedProvider(additionalProvider.address, {
        cred: 50, // Lower credibility value, ensure original Provider is selected
        evaluation_info: {
          provide_times: 0,
          misbehave: 0,
          involve_del: 0,
          content_types: 1
        },
        provider_address: additionalProvider.address
      });
      
      // Set additional Provider price - Set higher price, ensure not selected
      await providerContract.setPayment(additionalProvider.address, paymentPD, paymentPC * BigInt(2));
      
      // Add additional Provider to content hash mapping
      await contentContract.addProviderToContentHash(contentHash, additionalProvider.address);
      
      // Get Provider list again
      const updatedProviders = await contentContract.getProvidersByContentHash(contentHash);
      console.log("Updated Provider list:", updatedProviders);
      
      // Print all Provider information
      console.log("\nAll Provider information:");
      for (const providerAddr of updatedProviders) {
        try {
          const info = await providerContract.getProviderInfo(providerAddr);
          console.log(`Provider ${providerAddr} information:`);
          console.log(`- Credibility value: ${info.cred.toString()}`);
          console.log(`- Content type count: ${info.evaluation_info.content_types.toString()}`);
          
          // Get price
          const price = await providerContract.payment_PC(providerAddr);
          console.log(`- Provider set price: ${ethers.formatEther(price)} ETH`);
        } catch (e) {
          console.log(`Error getting Provider ${providerAddr} information:`, e.message);
        }
      }
      
      // Call consume method
      console.log("\nCall consume method to test OPS function...");
      const paymentCP = ethers.parseEther("300"); // Consumer willing to pay price
      const startIndex = 1; // Request start chunk index
      
      console.log("Consumer call consume method, parameters as follows:");
      console.log("Consumer address:", consumer1.address);
      console.log("Payment amount Payment_CP:", ethers.formatEther(paymentCP), "ETH");
      console.log("Request start chunk index a:", startIndex);
      console.log("Content hash root_m:", contentHash);
      
      // Calculate total payment amount: (n - a + 1) * payment_CP +2 , final balance should be a payment_CP
      const totalPayment = paymentCP * BigInt(contentChunks - startIndex + 1);
      console.log("Total payment amount:", ethers.formatEther(totalPayment), "ETH");
      
      try {
        // Call consume method
        const consumeTx = await mainContract.connect(consumer1).consume(
          consumer1.address,
          paymentCP,
          startIndex,
          contentHash,
          { value: totalPayment }
        );
        
        const consumeReceipt = await consumeTx.wait();
        console.log("Execution result status:", consumeReceipt.status === 1 ? "✅ consume method execution succeeded!" : "❌ consume transaction execution failed!");
        
        // Get selected Provider
        const selectedProvider = await mainContract.p_sel();
        console.log("OPS function selected Provider:", selectedProvider);
        console.log("Original Provider address:", provider1.address);
        console.log("Additional Provider address:", additionalProvider.address);
        console.log("Is original Provider selected:", selectedProvider === provider1.address);
        
        // Check selection logic
        if (selectedProvider === provider1.address) {
          console.log("✅ OPS function correctly selected credibility value higher and price suitable Provider");
        } else if (selectedProvider === additionalProvider.address) {
          console.log("❓ OPS function selected additional Provider, this may not meet expectations");
        } else {
          console.log("❌ OPS function selected unexpected Provider");
        }
        
        // Get selected Provider information
        const selectedInfo = await providerContract.getProviderInfo(selectedProvider);
        const selectedPrice = await providerContract.payment_PC(selectedProvider);
        
        console.log("Selected Provider information:");
        console.log(`- Credibility value: ${selectedInfo.cred.toString()}`);
        console.log(`- Provider set price: ${ethers.formatEther(selectedPrice)} ETH`);
        
        // Check contract status
        const contractState = await mainContract.round();
        console.log("Contract current status:", contractState.toString());
        
        // Check consumer ledger balance
        const consumerLedger = await mainContract.ledger(consumer1.address);
        console.log("Consumer ledger balance:", ethers.formatEther(consumerLedger), "ETH");
        
      } catch (error) {
        console.log("Error calling consume method:", error.message);
        
        // Try to get more detailed error information
        if (error.data) {
          try {
            const decodedError = mainContract.interface.parseError(error.data);
            console.log("Decoded error:", decodedError);
          } catch (e) {
            console.log("Cannot decode error data");
          }
        }
      }
      
      console.log("----------------------------------------------------------------------\n");
      
      // 9. Test select method
      console.log("\nStep 9: Test select method");
      console.log("----------------------------------------------------------------------");
      console.log("Provider select Deliverer");

      try {
        // Get current contract status
        const contractState = await mainContract.round();
        console.log("Current contract status:", contractState.toString());
        
        // Ensure contract in initiated state (3)
        if (contractState.toString() === "3") {
          console.log("Contract in initiated state, can call select method");
          
          // Prepare select method parameters
          const selectedDeliverers = [deliverer1.address, deliverer2.address];
          const delivererBids = [
            ethers.parseEther("8"), // deliverer1's payment
            ethers.parseEther("9")  // deliverer2's payment
          ];
          
          console.log("Selected Deliverer:", selectedDeliverers);
          console.log("Deliverer payment:", delivererBids.map(bid => ethers.formatEther(bid)));
          
          // Get selected Provider
          const selectedProvider = await mainContract.p_sel();
          console.log("Selected Provider:", selectedProvider);
          
          // Call select method
          const selectTx = await mainContract.connect(provider1).select(selectedDeliverers, delivererBids);
          const selectReceipt = await selectTx.wait();
          
          console.log("Execution result status:", selectReceipt.status === 1 ? "✅ select method execution succeeded!" : "❌ select transaction execution failed!");
          
          // Check selected Deliverer
          console.log("\nCheck selected Deliverer:");
          
          // Get selected Deliverer count
          const k = await mainContract.k();
          console.log("Selected Deliverer count k:", k.toString());
          
          // Get selected Deliverer list
          let selectedDeliverersList = [];
          for (let i = 0; i < k; i++) {
            try {
              const deliverer = await mainContract.getSelectedDeliverers(i);
              selectedDeliverersList.push(deliverer);
            } catch (e) {
              console.log(`Error getting selected Deliverer ${i}:`, e.message);
              break;
            }
          }
          
          console.log("Selected Deliverer list:", selectedDeliverersList);
          
          // Check Deliverer selected
          const isDeliverer1Selected = await mainContract.deliver_is_selected(deliverer1.address);
          const isDeliverer2Selected = await mainContract.deliver_is_selected(deliverer2.address);
          
          console.log("Is deliverer1 selected:", isDeliverer1Selected);
          console.log("Is deliverer2 selected:", isDeliverer2Selected);
          
          // Check Deliverer payment
          const deliverer1Bid = await mainContract.AddtoPaymentdp(deliverer1.address);
          const deliverer2Bid = await mainContract.AddtoPaymentdp(deliverer2.address);
          
          console.log("deliverer1 payment:", ethers.formatEther(deliverer1Bid), "ETH");
          console.log("deliverer2 payment:", ethers.formatEther(deliverer2Bid), "ETH");
          
          // Check contract status
          const newState = await mainContract.round();
          console.log("New contract status:", newState.toString());
          
          if (newState.toString() === "4") { // selected state
            console.log("✅ Contract successfully entered selected state");
          } else {
            console.log("❌ Contract not entered selected state, current status:", newState.toString());
          }
          
        } else {
          console.log("❌ Contract not in initiated state, cannot call select method");
        }
      } catch (error) {
        console.log("Error calling select method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");

      // 10. Test uploadFirstChunk method
      console.log("\nStep 10: Test uploadFirstChunk method");
      console.log("----------------------------------------------------------------------");
      console.log("Deliverer upload first chunk data");

      try {
        // Get current contract status
        const contractState = await mainContract.round();
        console.log("Current contract status:", contractState.toString());
        
        // Ensure contract in selected state (4)
        if (contractState.toString() === "4") {
          console.log("Contract in selected state, can call uploadFirstChunk method");
          
          // Prepare uploadFirstChunk method parameters
          const sid = 1; // Session ID
          const startChunk = 1; // Start chunk index
          const m1 = ethers.keccak256(ethers.toUtf8Bytes("This is the first chunk data")); // First chunk hash
          
          // Generate signature
          const messageHash = ethers.keccak256(
            ethers.solidityPacked(
              ["uint", "uint", "bytes32"],
              [sid, startChunk, m1]
            )
          );
          
          // Use deliverer1's private key to sign
          const signature = await deliverer1.signMessage(ethers.getBytes(messageHash));
          
          console.log("Session ID (sid):", sid);
          console.log("Start chunk index:", startChunk);
          console.log("First chunk hash (m1):", m1);
          console.log("Signature:", signature);
          
          // Call uploadFirstChunk method
          const uploadTx = await mainContract.connect(deliverer1).uploadFirstChunk(
            sid,
            startChunk,
            m1,
            signature
          );
          
          const uploadReceipt = await uploadTx.wait();
          console.log("Execution result status:", uploadReceipt.status === 1 ? "✅ uploadFirstChunk method execution succeeded!" : "❌ uploadFirstChunk transaction execution failed!");
          
          // Check uploaded data
          console.log("\nCheck uploaded data:");
          
          // Get uploaded data
          const chunkData = await mainContract.sid_to_chunk_data(sid);
          
          console.log("Uploaded data:");
          console.log("- Start chunk index:", chunkData.start_chunk.toString());
          console.log("- First chunk hash (m1):", chunkData.m1);
          console.log("- Signature:", chunkData.sigma_m1);
          console.log("- Deliverer:", chunkData.deliverer);
          console.log("- Is verified:", chunkData.verified);
          
        } else {
          console.log("❌ Contract not in selected state, cannot call uploadFirstChunk method");
        }
      } catch (error) {
        console.log("Error calling uploadFirstChunk method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");

      // 11. Test verifyFirstChunk method
      console.log("\nStep 11: Test verifyFirstChunk method");
      console.log("----------------------------------------------------------------------");
      console.log("Consumer verify first chunk data");

      try {
        // Get current contract status
        const contractState = await mainContract.round();
        console.log("Current contract status:", contractState.toString());
        
        // Ensure contract in selected state (4)
        if (contractState.toString() === "4") {
          console.log("Contract in selected state, can call verifyFirstChunk method");
          
          // Prepare verifyFirstChunk method parameters
          const sid = 1; // Session ID
          
          console.log("Session ID (sid):", sid);
          
          // Call verifyFirstChunk method
          const verifyTx = await mainContract.connect(consumer1).verifyFirstChunk(sid);
          const verifyReceipt = await verifyTx.wait();
          
          console.log("Execution result status:", verifyReceipt.status === 1 ? "✅ verifyFirstChunk method execution succeeded!" : "❌ verifyFirstChunk transaction execution failed!");
          
          // Check verify result
          console.log("\nCheck verify result:");
          
          // Get verified data
          const chunkData = await mainContract.sid_to_chunk_data(sid);
          console.log("Verified data:");
          console.log("- Is verified:", chunkData.verified);
          
          // Get start time
          const startTime = await mainContract.sid_to_start_time(sid);
          console.log("Start time:", startTime.toString());
          
          // Get start chunk index
          const a = await mainContract.a();
          console.log("Start chunk index a:", a.toString());
          
          // Check contract status
          const newState = await mainContract.round();
          console.log("New contract status:", newState.toString());
          
          if (newState.toString() === "5") { // first_delivered state
            console.log("✅ Contract successfully entered first_delivered state");
            const deliveredTx = await mainContract.connect(provider1).delivered();
            const deliveredReceipt = await deliveredTx.wait();
            console.log("Execution result status:", deliveredReceipt.status === 1 ? "✅ delivered method execution succeeded!" : "❌ delivered transaction execution failed!");
          } else {
            console.log("❌ Contract not entered first_delivered state, current status:", newState.toString());
          }
          
          // Add delay, wait for 2 seconds
          console.log("Wait for data interaction between S-R...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } else {
          console.log("❌ Contract not in selected state, cannot call verifyFirstChunk method");
        }
      } catch (error) {
        console.log("Error calling verifyFirstChunk method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");

      // 12. Test verifyPoDQProof method
      console.log("\nStep 12: Test verifyPoDQProof method");
      console.log("----------------------------------------------------------------------");
      console.log("Deliverer verify delivery proof");

      try {
        // Get current contract status
        const contractState = await mainContract.round();
        console.log("Current contract status:", contractState.toString());
        
        // Ensure contract in first_delivered state (5)
        if (contractState.toString() === "6") {
            console.log("Contract in first_delivered state, can call verifyPoDQProof method");
            
            // Get call before balance
            const deliverer1BalanceBefore = await ethers.provider.getBalance(deliverer1.address);
            const providerBalanceBefore = await ethers.provider.getBalance(provider1.address);
            const contractBalanceBefore = await ethers.provider.getBalance(await mainContract.getAddress());
            
            console.log("\nCall before balance:");
            console.log("- Deliverer balance:", ethers.formatEther(deliverer1BalanceBefore), "ETH");
            console.log("- Provider balance:", ethers.formatEther(providerBalanceBefore), "ETH");
            console.log("- Contract balance:", ethers.formatEther(contractBalanceBefore), "ETH");
            
            // Prepare verifyPoDQProof method parameters
            const sid = BigInt(1); // Session ID
            const i = BigInt(8);   // Last chunk index
            
            // Generate signature
            const messageHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["uint", "string", "uint", "address", "address"],
                    [sid, "receipt", i, deliverer1.address, consumer1.address]
                )
            );
            
            // Use consumer1's private key to sign
            const signature = await consumer1.signMessage(ethers.getBytes(messageHash));
            
            console.log("Session ID (sid):", sid.toString());
            console.log("Last chunk index i:", i.toString());
            console.log("Signature:", signature);
            
            // Call verifyPoDQProof method
            const verifyTx = await mainContract.connect(deliverer1).verifyPoDQProof(
                sid,
                i,
                signature
            );
            
            const verifyReceipt = await verifyTx.wait();
            console.log("Execution result status:", verifyReceipt.status === 1 ? "✅ verifyPoDQProof method execution succeeded!" : "❌ verifyPoDQProof transaction execution failed!");
            
            // Get call after balance
            const deliverer1BalanceAfter = await ethers.provider.getBalance(deliverer1.address);
            const providerBalanceAfter = await ethers.provider.getBalance(provider1.address);
            const contractBalanceAfter = await ethers.provider.getBalance(await mainContract.getAddress());
            
            console.log("\nCall after balance:");
            console.log("- Deliverer balance:", ethers.formatEther(deliverer1BalanceAfter), "ETH");
            console.log("- Provider balance:", ethers.formatEther(providerBalanceAfter), "ETH");
            console.log("- Contract balance:", ethers.formatEther(contractBalanceAfter), "ETH");
            
            // Calculate balance change - Use initialized BigNumber type
            const delivererBalanceChange = deliverer1BalanceAfter - initialDelivererBalance;
            const providerBalanceChange = providerBalanceAfter - initialProviderBalance;
            const contractBalanceChange = contractBalanceAfter - initialProviderBalance; // Or use 0
            
            console.log("\nBalance change:");
            console.log("- Provider balance change:", ethers.formatEther(providerBalanceChange), "ETH");
            console.log("- Deliverer balance change:", ethers.formatEther(delivererBalanceChange), "ETH");
            console.log("- Contract balance change:", ethers.formatEther(contractBalanceChange), "ETH");
            
            // Check PaymentSettled event
            const paymentSettledEvent = verifyReceipt.logs.find(
                log => log.eventName === 'PaymentSettled'
            );
            
            if (paymentSettledEvent) {
                const { deliverer, delivererPayment, provider, providerRefund, omega } = paymentSettledEvent.args;
                console.log("\nPaymentSettled event data:");
                console.log("- Deliverer address:", deliverer);
                console.log("- Refund amount:", ethers.formatEther(providerRefund), "ETH");
                console.log("- Distributed chunks:", omega.toString());
            } else {
                console.log("❌ PaymentSettled event not found");
            }
            
            // Add status check after verifyPoDQProof method execution
            const newStateAfterVFD = await mainContract.round();
            console.log("verifyPoDQProof after contract status:", newStateAfterVFD.toString());

            if (newStateAfterVFD.toString() === "7") { // delivered state
              console.log("✅ Contract successfully entered delivered state");
            } else {
              console.log("❌ Contract not entered delivered state, current status:", newStateAfterVFD.toString());
            }
            
        } else {
            console.log("❌ Contract not in first_delivered state, cannot call verifyPoDQProof method");
        }
      } catch (error) {
        console.log("Error calling verifyPoDQProof method:", error.message);
      }

  

      console.log("----------------------------------------------------------------------\n");

      // 13. Test revealKeys method
      console.log("\nStep 13: Test revealKeys method");
      console.log("----------------------------------------------------------------------");
      console.log("Provider reveal keys");

      try {
        // Get current contract status
        const contractState = await mainContract.round();
        console.log("Current contract status:", contractState.toString());
        
        // Ensure contract in revealing state (7)
        if (contractState.toString() === "7") {
          console.log("Contract in revealing state, can call revealKeys method");
          
          // Get related parameters
          const n = await mainContract.n();
          const a = await mainContract.a();
          const ctr = await mainContract.ctr();
          console.log(`n=${n}, a=${a}, ctr=${ctr}`);
          
          // Generate keys based on reveal_keys logic in Python code
          // Calculate keys to reveal
          const positions = [];
          
          // Calculate start index
          const startIndex = Number(n) + Number(a) - 2;
          
          // If ctr == 1, only reveal one key
          if (ctr == 1) {
            positions.push(startIndex);
          } 
          // If ctr == 2, based on start index's parity
          else if (ctr == 2) {
            if (startIndex % 2 !== 0) {
              // If odd, reveal parent node
              positions.push(Math.floor((startIndex - 1) / 2));
            } else {
              // If even, reveal two nodes
              positions.push(startIndex);
              positions.push(startIndex + 1);
            }
          }
          // For more chunks, use more complex logic
          else {
            // Simplified processing: directly reveal all needed chunks
            for (let i = 0; i < ctr; i++) {
              positions.push(startIndex + i);
            }
          }
          
          console.log("Keys to reveal:", positions);
          
          // Create G1Point structure - Each position needs 2 pairs of points
          const c_1s = [];
          const c_2s = [];
          
          // Generate 2 pairs of points for each position
          for (let i = 0; i < positions.length; i++) {
            // Generate two pairs of points for each position
            for (let j = 0; j < 2; j++) {
              const seed = BigInt(positions[i]) * 1000n + BigInt(j);
              
              // First pair of points
              c_1s.push({ 
                X: ethers.parseEther((seed * 2n + 1n).toString()), 
                Y: ethers.parseEther((seed * 2n + 2n).toString()) 
              });
              
              // Second pair of points
              c_2s.push({ 
                X: ethers.parseEther((seed * 2n + 100n).toString()), 
                Y: ethers.parseEther((seed * 2n + 101n).toString()) 
              });
            }
          }
          
          console.log("Position array length:", positions.length);
          console.log("c_1s array length:", c_1s.length);
          console.log("c_2s array length:", c_2s.length);
          
          // Check array length compliance
          if (c_1s.length === positions.length * 2 && c_2s.length === positions.length * 2) {
            console.log("✅ Array length compliance: c_1s and c_2s lengths are twice positions length");
          } else {
            console.log("❌ Array length not compliant");
            console.log(`positions length: ${positions.length}, c_1s length: ${c_1s.length}, c_2s length: ${c_2s.length}`);
          }
          
          // Call revealKeys method
          const revealTx = await mainContract.connect(provider1).revealKeys(positions, c_1s, c_2s);
          const revealReceipt = await revealTx.wait();
          
          console.log("Execution result status:", revealReceipt.status === 1 ? "✅ revealKeys method execution succeeded!" : "❌ revealKeys transaction execution failed!");
          console.log("gas cost :", revealReceipt.gasUsed);
          // Check emitErk event
          const emitErkEvents = revealReceipt.logs.filter(
            log => log.eventName === 'emitErk'
          );
          
          if (emitErkEvents.length > 0) {
            console.log("\nFound emitErk event:");
            console.log("Event count:", emitErkEvents.length);
            
            if (emitErkEvents.length === positions.length) {
              console.log("✅ Event count compliant with expectation");
            } else {
              console.log("❌ Event count not compliant with expectation");
            }
            
            // Only display detailed information for the first 3 events, avoid outputting too much
            const displayCount = Math.min(3, emitErkEvents.length);
            for (let i = 0; i < displayCount; i++) {
              const { position } = emitErkEvents[i].args;
              console.log(`Event ${i+1}:`);
              console.log("- Position:", position.toString());
            }
            
            if (emitErkEvents.length > displayCount) {
              console.log(`... and another ${emitErkEvents.length - displayCount} events`);
            }
          } else {
            console.log("❌ emitErk event not found");
          }
          
          // Check contract status
          const newState = await mainContract.round();
          console.log("New contract status:", newState.toString());
          
          if (newState.toString() === "8") { // revealed state
            console.log("✅ Contract successfully entered revealed state");
          } else {
            console.log("❌ Contract not entered revealed state(8), current status:", newState.toString());
          }
          
          // Get dispute timeout time
          const disputeTO = await mainContract.timeout_dispute();
          console.log("Dispute timeout time:", new Date(Number(disputeTO) * 1000).toLocaleString());
          
        } else {
          console.log("❌ Contract not in revealing state, cannot call revealKeys method");
        }
      } catch (error) {
        console.log("Error calling revealKeys method:", error.message);
        // Output more detailed error information
        if (error.data) {
          console.log("Error data:", error.data);
        }
        if (error.reason) {
          console.log("Error reason:", error.reason);
        }
      }

      console.log("----------------------------------------------------------------------\n");

      // 14. Test disputeTO method
      console.log("\nStep 14: Test disputeTO method");
      console.log("----------------------------------------------------------------------");
      console.log("Wait for dispute period to end and settle payment");

      try {
        // Get current contract status
        const contractState = await mainContract.round();
        console.log("Current contract status:", contractState.toString());
        
        // Ensure contract in revealed state (7)
        if (contractState.toString() === "8") {
          console.log("Contract in revealed state, can call disputeTO method");
          
          // Need to get initial statistics before calling disputeTO
          console.log("\nGet disputeTO before statistics:");

          // Provider initial statistics
          const providerInfoBefore = await providerContract.GetMyEval(provider1.address);
          console.log("Provider initial statistics:");
          console.log("- Number of services provided:", providerInfoBefore.provide_times.toString());
          console.log("- Involved Deliverer count:", providerInfoBefore.involve_del.toString());
          console.log("- Content type count:", providerInfoBefore.content_types.toString());

          // Consumer initial statistics
          const consumerInfoBefore = await consumerContract.GetMyConsumerInfo(consumer1.address);
          console.log("Consumer initial statistics:");
          console.log("- Download times:", consumerInfoBefore.evaluation_info.dl_times.toString());
          console.log("- Misbehavior times:", consumerInfoBefore.evaluation_info.misbehave.toString());

          // Call disputeTO method...
          console.log("\nCalling disputeTO method...");
          const disputeTx = await mainContract.disputeTO();
          const disputeReceipt = await disputeTx.wait();
          console.log("Execution result status:", disputeReceipt.status === 1 ? "✅ Success" : "❌ Failure");

          // Get updated statistics after calling disputeTO
          console.log("\nGet disputeTO after statistics:");

          // Provider updated statistics
          const providerInfoAfter = await providerContract.GetMyEval(provider1.address);
          console.log("Provider updated statistics:");
          console.log("- Number of services provided:", providerInfoAfter.provide_times.toString());
          console.log("- Involved Deliverer count:", providerInfoAfter.involve_del.toString());
          console.log("- Content type count:", providerInfoAfter.content_types.toString());

          // Verify Provider statistics compliance
          console.log("\nProvider statistics change verification:");
          if (providerInfoAfter.provide_times > providerInfoBefore.provide_times) {
            console.log("✅ Number of services provided increased: " + providerInfoBefore.provide_times + " → " + providerInfoAfter.provide_times);
          } else {
            console.log("❌ Number of services provided not increased");
          }

          if (providerInfoAfter.involve_del > providerInfoBefore.involve_del) {
            console.log("✅ Involved Deliverer count increased: " + providerInfoBefore.involve_del + " → " + providerInfoAfter.involve_del);
            
            // Get selected deliverer count
            let delivererCount = 0;
            try {
              // Try to get selected deliverer count from contract
              for (let i = 0; i < 10; i++) { // Assume not more than 10
                try {
                  const addr = await mainContract.getSelectedDeliverers(i);
                  if (addr && addr !== "0x0000000000000000000000000000000000000000") {
                    delivererCount++;
                  }
                } catch (e) {
                  break; // Reach end of array
                }
              }
            
            } catch (error) {
              console.log("   Cannot get selected Deliverer count:", error.message);
            }
          } else {
            console.log("❌ Involved Deliverer count not increased");
          }

          // Consumer updated statistics
          const consumerInfoAfter = await consumerContract.GetMyConsumerInfo(consumer1.address);
          console.log("\nConsumer updated statistics:");
          console.log("- Download times:", consumerInfoAfter.evaluation_info.dl_times.toString());
          console.log("- Misbehavior times:", consumerInfoAfter.evaluation_info.misbehave.toString());

          // Verify Consumer statistics compliance
          console.log("\nConsumer statistics change verification:");
          if (consumerInfoAfter.evaluation_info.dl_times > consumerInfoBefore.evaluation_info.dl_times) {
            console.log("✅ Download times increased: " + consumerInfoBefore.evaluation_info.dl_times + " → " + consumerInfoAfter.evaluation_info.dl_times);
          } else {
            console.log("❌ Download times not increased");
          }

          // Add balance check code after disputeTO call
          if (disputeReceipt.status === 1) {
            // Get actual call after balance
            const providerBalanceAfter = await ethers.provider.getBalance(provider1.address);
            const consumerBalanceAfter = await ethers.provider.getBalance(consumer1.address);
            const delivererBalanceAfter = await ethers.provider.getBalance(deliverer1.address);
            const contractBalanceAfter = await ethers.provider.getBalance(await mainContract.getAddress());

            console.log("\nActual call after balance:");
            console.log("- Provider balance:", ethers.formatEther(providerBalanceAfter), "ETH");
            console.log("- Consumer balance:", ethers.formatEther(consumerBalanceAfter), "ETH");
            console.log("- Deliverer balance:", ethers.formatEther(delivererBalanceAfter), "ETH");
            console.log("- Contract balance:", ethers.formatEther(contractBalanceAfter), "ETH");

            // Calculate overall balance change
            const providerBalanceChange = providerBalanceAfter - initialProviderBalance;
            const consumerBalanceChange = consumerBalanceAfter - initialConsumerBalance;
            const delivererBalanceChange = delivererBalanceAfter - initialDelivererBalance;

            console.log("\nBalance change analysis:");
            console.log("- Provider balance change:", ethers.formatEther(providerBalanceChange), "ETH");
            console.log("- Consumer balance change:", ethers.formatEther(consumerBalanceChange), "ETH");
            console.log("- Deliverer balance change:", ethers.formatEther(delivererBalanceChange), "ETH");

            // Check final fund distribution
            console.log("\nFinal fund distribution summary:");
            console.log("========================================================");
            console.log(`Provider: Initial ${ethers.formatEther(initialProviderBalance)} ETH → Now ${ethers.formatEther(providerBalanceAfter)} ETH`);
            console.log(`Consumer: Initial ${ethers.formatEther(initialConsumerBalance)} ETH → Now ${ethers.formatEther(consumerBalanceAfter)} ETH`);
            console.log(`Deliverer: Initial ${ethers.formatEther(initialDelivererBalance)} ETH → Now ${ethers.formatEther(delivererBalanceAfter)} ETH`);
            console.log(`Contract: Now ${ethers.formatEther(contractBalanceAfter)} ETH`);
            console.log("========================================================");
            console.log(`Fund flow: Provider ${ethers.formatEther(providerBalanceChange)} ETH, Consumer ${ethers.formatEther(consumerBalanceChange)} ETH, Deliverer ${ethers.formatEther(delivererBalanceChange)} ETH`);
            console.log("========================================================");
          }
        } else {
          console.log("❌ Contract not in revealed state, cannot call disputeTO method");
        }
      } catch (error) {
        console.log("Error calling disputeTO method:", error);
        // Output full error stack
        console.log("Error stack:", error.stack);
      }

    

    });
  });
});
