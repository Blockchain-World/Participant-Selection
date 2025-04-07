const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Add variables to store initial balances at the beginning of the test file
let initialProviderBalance;
let initialConsumerBalance;
let initialDelivererBalance;

describe("P2PCDN contract test", function () {
  // Define a fixture to reuse the same setup
  async function deployP2PCDNFixture() {
    console.log("start to deploy contracts...");
    
    // Get test accounts
    const [owner, provider1, deliverer1, deliverer2, consumer1] = await ethers.getSigners();
    console.log("test accounts prepared:");
    console.log("- Owner address:", owner.address);
    console.log("- Provider address:", provider1.address);
    console.log("- Deliverer1 address:", deliverer1.address);
    console.log("- Deliverer2 address:", deliverer2.address);
    console.log("- Consumer address:", consumer1.address);
    
    // Record initial balances - convert fixed values to BigNumber
    initialProviderBalance = ethers.parseEther("10000");
    initialConsumerBalance = ethers.parseEther("10000");
    initialDelivererBalance = ethers.parseEther("10000");
    
    console.log("\ninitial balances before deployment:");
    console.log("- Provider initial balance:", ethers.formatEther(initialProviderBalance), "ETH");
    console.log("- Consumer initial balance:", ethers.formatEther(initialConsumerBalance), "ETH");
    console.log("- Deliverer initial balance:", ethers.formatEther(initialDelivererBalance), "ETH");
    
    // Owner deploy global contracts
    console.log("\nOwner deploy global contracts...");
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
    
    // Provider deploy Main contract
    console.log("\nProvider deploy Main contract...");
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

  describe("basic flow test", function () {
    it("should be able to complete the content provision and distribution process", async function () {
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
      
      console.log("\nstart to test basic flow...");
      
      // Test data
      const contentHash = "0xcfd941c14535fc004b1668d312cdd472ac4df0903724ae1fcd544e924300033e";
      const contentChunks = 8;
      const paymentPD = ethers.parseEther("20"); // The offer for deliverer
      const paymentPC = ethers.parseEther("200"); // The offer for consumer
      
      console.log("test data prepared:");
      console.log("- content hash root_m:", contentHash);
      console.log("- content chunks n:", contentChunks);
      console.log("- deliverer's payment Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("- consumer's payment Payment_PC:", ethers.formatEther(paymentPC), "ETH");
      
      // Check the initial state of the Main contract at the beginning of the test
      const initialRound = await mainContract.round();
      console.log("initial state:", initialRound);
      // If the initial state is not started (0), it may need to set the state
      if (initialRound.toString() !== "0") {
        console.log("warning: contract is not in started state");
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

      // Get the ETH balance of the Main contract
      const mainContractBalance = await ethers.provider.getBalance(await mainContract.getAddress());
      // Get the ETH balance of the Provider contract
      const ledgerpk_provider1 = await mainContract.connect(provider1).ledger(provider1.address);

      console.log("\nstep 1: provider start process");
      console.log("----------------------------------------------------------------------");
      console.log("provider start to call Start method, parameters as follows:");
      console.log("provider address:", provider1.address);
      console.log("content hash root_m:", contentHash);
      console.log("content chunks n:", contentChunks);
      console.log("deliverer's payment Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("consumer's payment Payment_PC:", ethers.formatEther(paymentPC), "ETH");
      console.log("transferred amount to contract:", ethers.formatEther(paymentPD * BigInt(contentChunks+2)), "ETH");
      console.log("execution result status:", resp.status === 1 ? "✅ start method transaction executed successfully!" : "❌ start transaction executed failed!");
      console.log("Main contract ETH balance:", ethers.formatEther(mainContractBalance), "ETH");
      console.log("ledger[pk_provider1] balance:", ethers.formatEther(ledgerpk_provider1), "ETH");
      console.log("----------------------------------------------------------------------\n");
      


      // 2. Deliverer1 join
      console.log("\nstep 2.1: deliverer1 call join method");
      console.log("----------------------------------------------------------------------");
      // deliverer1's bid can be lower than the highest price set by the Provider
      const deliverer2Bid = ethers.parseEther("9"); // deliverer2's bid
      const deliverer1Bid = ethers.parseEther("8"); // deliverer1's bid
      // deliverer1 join
      const joinTx1 = await mainContract.connect(deliverer1).join(deliverer1Bid);
      const resp1 = await joinTx1.wait();
            
      // deliverer2 join
      const joinTx2 = await mainContract.connect(deliverer2).join(deliverer2Bid);
      const resp2 =     await joinTx2.wait();

      console.log("Deliverer1 start to call Join method, parameters as follows:");
      console.log("Deliverer1 address:", deliverer1.address);
      console.log("Deliverer1 bid Payment_DP:", ethers.formatEther(deliverer1Bid), "ETH");
      console.log("Provider highest acceptable price Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("execution result status:", resp1.status === 1 ? "✅ join method executed successfully!" : "❌ join transaction executed failed!");

      // Add code to check Deliverer initialization information
      console.log("\nCheck Deliverer initialization information:");
      try {
        // Get all Deliverer addresses
        const allDeliverers = await delivererContract.getDelivererAddress();
        console.log("All Deliverer addresses:", allDeliverers);
        
        // 检查deliverer1是否在列表中
        const isDeliverer1InList = allDeliverers.includes(deliverer1.address);
        console.log("deliverer1 is in Deliverer list:", isDeliverer1InList);
        
        if (isDeliverer1InList) {
          // Get deliverer1's credibility value
          const cred = await delivererContract.GetMyCred(deliverer1.address);
          console.log("deliverer1's credibility value:", cred.toString());
          
          // Get deliverer1's evaluation information
          const eval = await delivererContract.GetMyEval(deliverer1.address);
          console.log("deliverer1's evaluation information:");
          console.log("- delivery number:", eval.delivery_nums.toString());
          console.log("- total amount:", eval.total_amount.toString());
          console.log("- average speed:", eval.avg_speed.toString());
        } else {
          console.log("❌ deliverer1 is not initialized correctly!");
        }
      } catch (error) {
        console.log("Error checking Deliverer initialization information:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");
      
      // 2.1. Deliverer2加入
      console.log("\nStep 2.2: deliverer2 call join method");
      console.log("----------------------------------------------------------------------");
      // deliverer2的报价可以与deliverer1不同

      console.log("Deliverer2 start to call Join method, parameters as follows:");
      console.log("Deliverer2 address:", deliverer2.address);
      console.log("Deliverer2 bid Payment_PD:", ethers.formatEther(deliverer2Bid), "ETH");
      console.log("Provider highest acceptable price Payment_PD:", ethers.formatEther(paymentPD), "ETH");
      console.log("execution result status:", resp2.status === 1 ? "✅ join method executed successfully!" : "❌ join transaction executed failed!");
      // 检查deliverer是否已加入
      const isCandidate1 = await mainContract.iscandidate(deliverer1.address);
      console.log("deliverer1 is a candidate:", isCandidate1);
            
      const isCandidate2 = await mainContract.iscandidate(deliverer2.address);
      console.log("deliverer2 is a candidate:", isCandidate2);
      console.log("----------------------------------------------------------------------\n\n");
      

      

      
      // 3. Stop join phase
      console.log("Step 3: stop the join phase (manually stop, otherwise wait for time to pass)");
      console.log("----------------------------------------------------------------------");
      console.log("Provider sends Content to all Candidate deliverers");
      // 由于 provider1 是 Main 合约的部署者，所以它应该是 owner
      const joinStopTx = await mainContract.connect(provider1).join_stop();
      await joinStopTx.wait();
      console.log("join phase stopped");
      const resp3 = await joinStopTx.wait();
      console.log("execution result status:", resp3.status === 1 ? "✅ join_stop method executed successfully!" : "❌ join_stop transaction executed failed!");
      console.log("----------------------------------------------------------------------\n");
      
      
      
      // 4. deliverer准备就绪
      console.log("\nStep 4: deliverer1/deliverer2 call deliverers_prepared method");
      console.log("----------------------------------------------------------------------");
      console.log("Deliverers receive Content and store locally, then reply Provider ready");
      const url1 = "https://example.com/content1";
      const url2 = "https://example.com/content2";

      const prepared1Tx = await mainContract.connect(deliverer1).deliverers_prepared(url1);
      await prepared1Tx.wait();
      console.log("deliverer1 is ready, providing URL:", url1);

      const prepared2Tx = await mainContract.connect(deliverer2).deliverers_prepared(url2);
      await prepared2Tx.wait();
      console.log("deliverer2 is ready, providing URL:", url2);

      // Check preparation
      console.log("View prepared_candidate_deliverers array data on chain:");
      
      try {
        // Try to get array length
        let length = 0;
        let preparedDeliverers = [];
        
        // Loop to try getting array elements until failure
        while (true) {
          try {
            const address = await mainContract.prepared_candidate_deliverers(length);
            preparedDeliverers.push(address);
            length++;
          } catch (e) {
            // Exit loop when index is out of range
            break;
          }
        }
        
        console.log("prepared_candidate_deliverers array length:", length);
        console.log("prepared_candidate_deliverers array content:", preparedDeliverers);
        
        // Check if specific addresses are in the array
        const isPrepared1 = preparedDeliverers.includes(deliverer1.address);
        const isPrepared2 = preparedDeliverers.includes(deliverer2.address);
        
        console.log("deliverer1 address:", deliverer1.address);
        console.log("Is deliverer1 in prepared list:", isPrepared1);
        console.log("deliverer2 address:", deliverer2.address);
        console.log("Is deliverer2 in prepared list:", isPrepared2);
        // Get number of prepared deliverers
        const preparedCount = preparedDeliverers.length;
        console.log("Number of prepared deliverers:", preparedCount.toString());
        
      } catch (error) {
        console.log("Error querying prepared_candidate_deliverers array:", error.message);
      }
      
      console.log("----------------------------------------------------------------------\n");

      
      // 5. Provider prepared
      console.log("\nStep 5: Provider prepared");
      console.log("----------------------------------------------------------------------");
      // Check Main contract owner
      const contractOwner = await mainContract.owner();
      console.log("Contract owner:", contractOwner);
      // Use correct account to call prepared
      const ownerPreparedTx = await mainContract.connect(
        contractOwner === provider1.address ? provider1 : owner
      ).prepared();
      await ownerPreparedTx.wait();
      console.log("Provider has confirmed preparation completion");

      // Immediately check state after prepared() execution
      console.log("\nContract state after preparation:");
      try {
        // Get current contract state
        const currentState = await mainContract.round();
        console.log("Current contract state:", currentState.toString());
        
        // Check if entered ready state
        if (currentState.toString() === "2") { // ready state enum value
          console.log("✅ Contract successfully entered ready state");
        } else {
          console.log("❌ Contract did not enter ready state, current state:", currentState.toString());
        }
        
        // Extended global contract data check section
        console.log("\nGlobal contract data check:");
        
        // 1. Check data in Content contract
        console.log("\n1. Content contract data check:");
        try {
          const providersForContent = await contentContract.getProvidersByContentHash(contentHash);
          console.log("Provider list for this content in Content contract:", providersForContent);
          console.log("Is Provider added to content hash mapping:", providersForContent.includes(provider1.address));
          
          // Try to get more content related information
          console.log("Attempting to get all content hashes...");
          try {
          } catch (e) {
            console.log("Unable to get all content hashes:", e.message);
          }
        } catch (error) {
          console.log("Error checking Content contract data:", error.message);
        }
        
        // 3. Check data in Deliverer contract
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
              console.log("- Reputation value:", deliverer1Cred.toString());
              console.log("- Number of services provided:", deliverer1Eval.delivery_nums.toString());
              console.log("- Total amount:", deliverer1Eval.total_amount.toString());
              console.log("- Average speed:", deliverer1Eval.avg_speed.toString());
            } catch (e) {
              console.log("Unable to get deliverer1 information:", e.message);
            }
          }
        } catch (error) {
          console.log("Error checking Deliverer contract data:", error.message);
        }
        
        try {
          // Try to get consumer information
          try {
          } catch (e) {
            console.log("Unable to get Consumer information or Consumer not registered:", e.message);
          }
        } catch (error) {
          console.log("Error checking Consumer contract data:", error.message);
        }
        
        // 5. Check data in Main contract
        console.log("\n5. Main contract data check:");
        try {
          // Get basic information in Main contract
          const rootM = await mainContract.root_m();
          const n = await mainContract.n();
          const paymentPD = await mainContract.payment_PD();
          const paymentPC = await mainContract.payment_PC();
          const round = await mainContract.round();
          
          console.log("Content hash root_m:", rootM);
          console.log("Number of content chunks n:", n.toString());
          console.log("Deliverer payment amount payment_PD:", ethers.formatEther(paymentPD), "ETH");
          console.log("Consumer payment amount payment_PC:", ethers.formatEther(paymentPC), "ETH");
          console.log("Current round state round:", round.toString());
          
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
          
          console.log("Number of candidate Deliverers:", allCandidateCount);
          console.log("Candidate Deliverer list:", allCandidates);
          
          // Get prepared candidate Deliverer information
          console.log("\nPrepared candidate Deliverer information:");
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
          
          console.log("Number of prepared candidate Deliverers:", preparedCount);
          console.log("Prepared candidate Deliverer list:", preparedCandidates);
          
        } catch (error) {
          console.log("Error checking Main contract data:", error.message);
        }
        
      } catch (error) {
        console.log("Error checking state after prepared() execution:", error.message);
      }
      console.log("----------------------------------------------------------------------\n");

      
      // 6. Verify if content has been added to Provider
      console.log("\nStep 6: Verify if content has been added to Provider");
      console.log("----------------------------------------------------------------------\n");
      // Check Main contract owner
      const providerList = await contentContract.getProvidersByContentHash(contentHash);
      console.log("Content Provider list:", providerList);
      
      // Check if Provider is in the list
      const providerInList = providerList.includes(provider1.address);
      console.log("Is deliverer1 in prepared_candidate_deliverers array:", providerInList);
      console.log("----------------------------------------------------------------------\n");
      // Check Main contract owner
      // 7. Check if Provider content type count has increased
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
      console.log("Current Provider list for content:", providersForContent);
      
      // Create an additional Provider for testing
      console.log("\nAdding an additional Provider for testing...");
      
      // Use owner as additional Provider
      const additionalProvider = owner;
      console.log("Additional Provider address:", additionalProvider.address);
      
      // Initialize additional Provider
      await providerContract.initializeProvider(additionalProvider.address);
      
      // Set additional Provider's reputation value and price
      await providerContract.GetSelectedProvider(additionalProvider.address, {
        cred: 50, // Lower reputation value to ensure original Provider is selected
        evaluation_info: {
          provide_times: 0,
          misbehave: 0,
          involve_del: 0,
          content_types: 1
        },
        provider_address: additionalProvider.address
      });
      
      // Set additional Provider's price - set higher price to ensure not selected
      await providerContract.setPayment(additionalProvider.address, paymentPD, paymentPC * BigInt(2));
      
      // Add additional Provider to content hash mapping
      await contentContract.addProviderToContentHash(contentHash, additionalProvider.address);
      
      // Get Provider list again
      const updatedProviders = await contentContract.getProvidersByContentHash(contentHash);
      console.log("Updated Provider list:", updatedProviders);
      
      // Print information for all Providers
      console.log("\nAll Provider information:");
      for (const providerAddr of updatedProviders) {
        try {
          const info = await providerContract.getProviderInfo(providerAddr);
          console.log(`Provider ${providerAddr} information:`);
          console.log(`- Reputation value: ${info.cred.toString()}`);
          console.log(`- Number of content types: ${info.evaluation_info.content_types.toString()}`);
          
          // Get price
          const price = await providerContract.payment_PC(providerAddr);
          console.log(`- Provider's price: ${ethers.formatEther(price)} ETH`);
        } catch (e) {
          console.log(`Error getting Provider ${providerAddr} information:`, e.message);
        }
      }
      
      // Call consume method
      console.log("\nCalling consume method to test OPS function...");
      const paymentCP = ethers.parseEther("300"); // Price consumer is willing to pay
      const startIndex = 1; // Requested starting chunk index
      
      console.log("Consumer calling consume method with parameters:");
      console.log("Consumer address:", consumer1.address);
      console.log("Payment amount Payment_CP:", ethers.formatEther(paymentCP), "ETH");
      console.log("Requested starting chunk index a:", startIndex);
      console.log("Content hash root_m:", contentHash);
      
      // Calculate total payment needed: (n - a + 1) * payment_CP +2, final balance should be one payment_CP
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
        console.log("Execution result status:", consumeReceipt.status === 1 ? "✅ consume method executed successfully!" : "❌ consume transaction failed!");
        
        // Get selected Provider
        const selectedProvider = await mainContract.p_sel();
        console.log("Provider selected by OPS function:", selectedProvider);
        console.log("Original Provider address:", provider1.address);
        console.log("Additional Provider address:", additionalProvider.address);
        console.log("Was original Provider selected:", selectedProvider === provider1.address);
        
        // Check selection logic
        if (selectedProvider === provider1.address) {
          console.log("✅ OPS function correctly selected Provider with higher reputation and appropriate price");
        } else if (selectedProvider === additionalProvider.address) {
          console.log("❓ OPS function selected additional Provider, this may not be expected");
        } else {
          console.log("❌ OPS function selected unexpected Provider");
        }
        
        // Get selected Provider information
        const selectedInfo = await providerContract.getProviderInfo(selectedProvider);
        const selectedPrice = await providerContract.payment_PC(selectedProvider);
        
        console.log("Selected Provider information:");
        console.log(`- Reputation value: ${selectedInfo.cred.toString()}`);
        console.log(`- Provider's price: ${ethers.formatEther(selectedPrice)} ETH`);
        
        // Check contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
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
            console.log("Unable to decode error data");
          }
        }
      }
      
      console.log("----------------------------------------------------------------------\n");
      
      // 9. Test select method
      console.log("\nStep 9: Test select method");
      console.log("----------------------------------------------------------------------");
      console.log("Provider selecting Deliverer");

      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
        // Ensure contract is in initiated state (3)
        if (contractState.toString() === "3") {
          console.log("Contract is in initiated state, can call select method");
          
          // Prepare select method parameters
          const selectedDeliverers = [deliverer1.address, deliverer2.address];
          const delivererBids = [
            ethers.parseEther("8"), // deliverer1's bid
            ethers.parseEther("9")  // deliverer2's bid
          ];
          
          console.log("Selected Deliverers:", selectedDeliverers);
          console.log("Deliverer bids:", delivererBids.map(bid => ethers.formatEther(bid)));
          
          // Get selected Provider
          const selectedProvider = await mainContract.p_sel();
          console.log("Selected Provider:", selectedProvider);
          
          // Call select method
          const selectTx = await mainContract.connect(provider1).select(selectedDeliverers, delivererBids);
          const selectReceipt = await selectTx.wait();
          
          console.log("Execution result status:", selectReceipt.status === 1 ? "✅ select method executed successfully!" : "❌ select transaction failed!");
          
          // Check selected Deliverers
          console.log("\nChecking selected Deliverers:");
          
          // Get number of selected Deliverers
          const k = await mainContract.k();
          console.log("Number of selected Deliverers k:", k.toString());
          
          // Get selected Deliverer list
          let selectedDeliverersList = [];
          for (let i = 0; i < k; i++) {
            try {
              const deliverer = await mainContract.getSelectedDeliverers(i);
              selectedDeliverersList.push(deliverer);
            } catch (e) {
              console.log(`Error getting ${i}th selected Deliverer:`, e.message);
              break;
            }
          }
          
          console.log("Selected Deliverer list:", selectedDeliverersList);
          
          // Check if Deliverers are selected
          const isDeliverer1Selected = await mainContract.deliver_is_selected(deliverer1.address);
          const isDeliverer2Selected = await mainContract.deliver_is_selected(deliverer2.address);
          
          console.log("Is deliverer1 selected:", isDeliverer1Selected);
          console.log("Is deliverer2 selected:", isDeliverer2Selected);
          
          // Check Deliverer bids
          const deliverer1Bid = await mainContract.AddtoPaymentdp(deliverer1.address);
          const deliverer2Bid = await mainContract.AddtoPaymentdp(deliverer2.address);
          
          console.log("deliverer1's bid:", ethers.formatEther(deliverer1Bid), "ETH");
          console.log("deliverer2's bid:", ethers.formatEther(deliverer2Bid), "ETH");
          
          // Check contract state
          const newState = await mainContract.round();
          console.log("New contract state:", newState.toString());
          
          if (newState.toString() === "4") { // selected state
            console.log("✅ Contract successfully entered selected state");
          } else {
            console.log("❌ Contract did not enter selected state, current state:", newState.toString());
          }
          
        } else {
          console.log("❌ Contract is not in initiated state, cannot call select method");
        }
      } catch (error) {
        console.log("Error calling select method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");

      // 10. Test uploadFirstChunk method
      console.log("\nStep 10: Test uploadFirstChunk method");
      console.log("----------------------------------------------------------------------");
      console.log("Deliverer uploading first chunk data");

      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
        // Ensure contract is in selected state (4)
        if (contractState.toString() === "4") {
          console.log("Contract is in selected state, can call uploadFirstChunk method");
          
          // Prepare uploadFirstChunk method parameters
          const sid = 1; // Session ID
          const startChunk = 1; // Starting chunk index
          const m1 = ethers.keccak256(ethers.toUtf8Bytes("This is the first chunk's data")); // First chunk's hash
          
          // Generate signature
          const messageHash = ethers.keccak256(
            ethers.solidityPacked(
              ["uint", "uint", "bytes32"],
              [sid, startChunk, m1]
            )
          );
          
          // Sign with deliverer1's private key
          const signature = await deliverer1.signMessage(ethers.getBytes(messageHash));
          
          console.log("Session ID (sid):", sid);
          console.log("Starting chunk index:", startChunk);
          console.log("First chunk's hash (m1):", m1);
          console.log("Signature:", signature);
          
          // Call uploadFirstChunk method
          const uploadTx = await mainContract.connect(deliverer1).uploadFirstChunk(
            sid,
            startChunk,
            m1,
            signature
          );
          
          const uploadReceipt = await uploadTx.wait();
          console.log("Execution result status:", uploadReceipt.status === 1 ? "✅ uploadFirstChunk method executed successfully!" : "❌ uploadFirstChunk transaction failed!");
          
          // Check uploaded data
          console.log("\nChecking uploaded data:");
          
          // Get uploaded data
          const chunkData = await mainContract.sid_to_chunk_data(sid);
          
          console.log("Uploaded data:");
          console.log("- Starting chunk index:", chunkData.start_chunk.toString());
          console.log("- First chunk's hash (m1):", chunkData.m1);
          console.log("- Signature:", chunkData.sigma_m1);
          console.log("- Deliverer:", chunkData.deliverer);
          console.log("- Is verified:", chunkData.verified);
          
        } else {
          console.log("❌ Contract is not in selected state, cannot call uploadFirstChunk method");
        }
      } catch (error) {
        console.log("Error calling uploadFirstChunk method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");

      // 11. Test verifyFirstChunk method
      console.log("\nStep 11: Test verifyFirstChunk method");
      console.log("----------------------------------------------------------------------");
      console.log("Consumer verifying first chunk data");

      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
        // Ensure contract is in selected state (4)
        if (contractState.toString() === "4") {
          console.log("Contract is in selected state, can call verifyFirstChunk method");
          
          // Prepare verifyFirstChunk method parameters
          const sid = 1; // Session ID
          
          console.log("Session ID (sid):", sid);
          
          // Call verifyFirstChunk method
          const verifyTx = await mainContract.connect(consumer1).verifyFirstChunk(sid);
          const verifyReceipt = await verifyTx.wait();
          
          console.log("Execution result status:", verifyReceipt.status === 1 ? "✅ verifyFirstChunk method executed successfully!" : "❌ verifyFirstChunk transaction failed!");
          
          // Check verification result
          console.log("\nChecking verification result:");
          
          // Get verified data
          const chunkData = await mainContract.sid_to_chunk_data(sid);
          console.log("Verified data:");
          console.log("- Is verified:", chunkData.verified);
          
          // Get start time
          const startTime = await mainContract.sid_to_start_time(sid);
          console.log("Start time:", startTime.toString());
          
          // Get starting chunk index
          const a = await mainContract.a();
          console.log("Starting chunk index a:", a.toString());
          
          // Check contract state
          const newState = await mainContract.round();
          console.log("New contract state:", newState.toString());
          
          if (newState.toString() === "5") { // first_delivered state
            console.log("✅ Contract successfully entered first_delivered state");
          } else {
            console.log("❌ Contract did not enter first_delivered state, current state:", newState.toString());
          }
          
          // Add delay, wait 2 seconds
          console.log("Waiting for S-R data interaction...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } else {
          console.log("❌ Contract is not in selected state, cannot call verifyFirstChunk method");
        }
      } catch (error) {
        console.log("Error calling verifyFirstChunk method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");
      console.log("----------------------------------------------------------------------");
      console.log("Consumer calling delivered method");
      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        // Ensure contract is in first_delivered state (5)
        if (contractState.toString() === "5") {
          console.log("Contract is in first_delivered state, can call delivered method");
          // Call delivered method
          const deliveredTx = await mainContract.connect(consumer1).delivered();
          const deliveredReceipt = await deliveredTx.wait();
          console.log("Execution result status:", deliveredReceipt.status === 1 ? "✅ delivered method executed successfully!" : "❌ delivered transaction failed!");
          // Check contract state
          const newStateAfterDelivered = await mainContract.round();
          console.log("Contract state after delivered:", newStateAfterDelivered.toString());
          if (newStateAfterDelivered.toString() === "6") { // delivered state
            console.log("✅ Contract successfully entered delivered state");
          } else {
            console.log("❌ Contract did not enter delivered state, current state:", newStateAfterDelivered.toString());
          }
        } else {
          console.log("❌ Contract is not in first_delivered state, cannot call delivered method");
        }
      } catch (error) {
        console.log("Error calling delivered method:", error.message);
      }

      // 12. Test verifyPoDQProof method
      console.log("\nStep 12: Test verifyPoDQProof method");
      console.log("----------------------------------------------------------------------");
      console.log("Deliverer verifying delivery proof");

      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
        // Ensure contract is in first_delivered state (6)
        if (contractState.toString() === "6") {
            console.log("Contract is in delivered state, can call verifyPoDQProof method");
            
            // Get balances before call
            const deliverer1BalanceBefore = await ethers.provider.getBalance(deliverer1.address);
            const providerBalanceBefore = await ethers.provider.getBalance(provider1.address);
            const contractBalanceBefore = await ethers.provider.getBalance(await mainContract.getAddress());
            
            console.log("\nBalances before call:");
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
            
            // Sign with consumer1's private key
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
            console.log("Execution result status:", verifyReceipt.status === 1 ? "✅ verifyPoDQProof method executed successfully!" : "❌ verifyPoDQProof transaction failed!");
            
            // Get balances after call
            const deliverer1BalanceAfter = await ethers.provider.getBalance(deliverer1.address);
            const providerBalanceAfter = await ethers.provider.getBalance(provider1.address);
            const contractBalanceAfter = await ethers.provider.getBalance(await mainContract.getAddress());
            
            console.log("\nBalances after call:");
            console.log("- Deliverer balance:", ethers.formatEther(deliverer1BalanceAfter), "ETH");
            console.log("- Provider balance:", ethers.formatEther(providerBalanceAfter), "ETH");
            console.log("- Contract balance:", ethers.formatEther(contractBalanceAfter), "ETH");
            
            // Calculate balance changes - using initialized BigNumber type
            const delivererBalanceChange = deliverer1BalanceAfter - initialDelivererBalance;
            const providerBalanceChange = providerBalanceAfter - initialProviderBalance;
            const contractBalanceChange = contractBalanceAfter - initialProviderBalance; // or use 0
            
            console.log("\nBalance changes:");
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
                console.log("- Number of delivered chunks:", omega.toString());
            } else {
                console.log("❌ PaymentSettled event not found");
            }
            
        } else {
            console.log("❌ Contract is not in first_delivered state, cannot call verifyPoDQProof method");
        }
      } catch (error) {
        console.log("Error calling verifyPoDQProof method:", error.message);
      }

  

      console.log("----------------------------------------------------------------------\n");

      
      // 13. Test revealKeys method
      console.log("\nStep 13: Test revealKeys method");
      console.log("----------------------------------------------------------------------");
      console.log("Provider revealing keys");

      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
        // Ensure contract is in delivered state (6)
        if (contractState.toString() === "6") {
          console.log("Contract is in delivered state, can call revealKeys method");
          
          // Prepare revealKeys method parameters
          const sid = BigInt(1); // Session ID
          const a = BigInt(0);   // Starting chunk index
          const b = BigInt(8);   // Last chunk index
          
          // Generate G1Point structures
          const c_1s = [];
          const c_2s = [];
          
          // Generate pairs of points for each position
          for (let i = 0; i < 9; i++) {
            const c_1 = {
              x: BigInt(1 + i),
              y: BigInt(2 + i)
            };
            const c_2 = {
              x: BigInt(3 + i),
              y: BigInt(4 + i)
            };
            c_1s.push(c_1);
            c_2s.push(c_2);
          }
          
          console.log("Generated c_1s length:", c_1s.length);
          console.log("Generated c_2s length:", c_2s.length);
          
          // Call revealKeys method
          const revealTx = await mainContract.connect(provider1).revealKeys(
            sid,
            a,
            b,
            c_1s,
            c_2s
          );
          
          const revealReceipt = await revealTx.wait();
          console.log("Execution result status:", revealReceipt.status === 1 ? "✅ revealKeys method executed successfully!" : "❌ revealKeys transaction failed!");
          
          // Check emitErk event
          const emitErkEvent = revealReceipt.logs.find(
            log => log.eventName === 'emitErk'
          );
          
          if (emitErkEvent) {
            const { erk } = emitErkEvent.args;
            console.log("\nemitErk event data:");
            console.log("- ERK:", erk);
          } else {
            console.log("❌ emitErk event not found");
          }
          
          // Check contract state
          const newState = await mainContract.round();
          console.log("New contract state:", newState.toString());
          
          if (newState.toString() === "7") { // revealed state
            console.log("✅ Contract successfully entered revealed state");
          } else {
            console.log("❌ Contract did not enter revealed state, current state:", newState.toString());
          }
          
        } else {
          console.log("❌ Contract is not in delivered state, cannot call revealKeys method");
        }
      } catch (error) {
        console.log("Error calling revealKeys method:", error.message);
      }

      // 14. Test wrongRK method
      console.log("\nStep 14: Test wrongRK method");
      console.log("----------------------------------------------------------------------");
      console.log("Consumer reporting wrong root key");

      try {
        // Get current contract state
        const contractState = await mainContract.round();
        console.log("Current contract state:", contractState.toString());
        
        // Ensure contract is in revealed state (7)
        if (contractState.toString() === "7") {
          console.log("Contract is in revealed state, can call wrongRK method");
          
          // Get provider's misbehavior count before call
          const providerInfo = await delivererContract.providers(provider1.address);
          const initialMisbehaveCount = providerInfo.misbehave_count;
          console.log("Provider's initial misbehavior count:", initialMisbehaveCount.toString());
          
          // Call wrongRK method
          const wrongTx = await mainContract.connect(consumer1).wrongRK();
          const wrongReceipt = await wrongTx.wait();
          
          console.log("Execution result status:", wrongReceipt.status === 1 ? "✅ wrongRK method executed successfully!" : "❌ wrongRK transaction failed!");
          
          // Check provider's misbehavior count after call
          const updatedProviderInfo = await delivererContract.providers(provider1.address);
          const newMisbehaveCount = updatedProviderInfo.misbehave_count;
          console.log("Provider's new misbehavior count:", newMisbehaveCount.toString());
          
          if (newMisbehaveCount > initialMisbehaveCount) {
            console.log("✅ Provider's misbehavior count increased as expected");
          } else {
            console.log("❌ Provider's misbehavior count did not increase");
          }
          
          // Check contract state
          const newState = await mainContract.round();
          console.log("New contract state:", newState.toString());
          
          if (newState.toString() === "8") { // disputed state
            console.log("✅ Contract successfully entered disputed state");
          } else {
            console.log("❌ Contract did not enter disputed state, current state:", newState.toString());
          }
          
        } else {
          console.log("❌ Contract is not in revealed state, cannot call wrongRK method");
        }
      } catch (error) {
        console.log("Error calling wrongRK method:", error.message);
      }

      console.log("----------------------------------------------------------------------\n");

      // 15. Test PoM method
      console.log("\nStep 15: Test PoM method");
      console.log("----------------------------------------------------------------------");

      try {
        // 先检查合约状态是否为 revealed (7)
        const stateBeforePoM = await mainContract.round();
        console.log("Current contract state:", stateBeforePoM.toString());
        
        if (stateBeforePoM.toString() === "8") { // revealed 状态
          console.log("✅ Contract is in revealed state, can test PoM");
          
          // 记录调用前的状态
          const providerMisbehaveBefore = await providerContract.GetMyMisbehave(provider1.address);
          const consumerMisbehaveBefore = await consumerContract.GetMyMisbehave(consumer1.address);
          const consumerLedgerBefore = await mainContract.ledger(consumer1.address);
          const providerLedgerBefore = await mainContract.ledger(provider1.address);
          
          console.log("\nPoM call before state:");
          console.log("- Provider misbehavior count:", providerMisbehaveBefore.toString());
          console.log("- Consumer misbehavior count:", consumerMisbehaveBefore.toString());
          console.log("- Consumer ledger balance:", ethers.formatEther(consumerLedgerBefore), "ETH");
          console.log("- Provider ledger balance:", ethers.formatEther(providerLedgerBefore), "ETH");
          
          // 获取当前合约参数
          const n = await mainContract.n();
          const a = await mainContract.a();
          const ctr = await mainContract.ctr();
          const payment_PC = await mainContract.payment_PC();
          const root_m = await mainContract.root_m();
          
          console.log("\nContract parameters:");
          console.log("- Total blocks n:", n.toString());
          console.log("- Start block index a:", a.toString());
          console.log("- Delivered blocks ctr:", ctr.toString());
          console.log("- Content root hash root_m:", root_m);
          console.log("- Payment per block payment_PC:", ethers.formatEther(payment_PC), "ETH");
          
          // 准备 PoM 方法所需的参数
          console.log("\nPrepare PoM method parameters...");
          
          // 1. _i_j_steps: 表示步骤的数组
          const _i_j_steps = [1, 2, 3]; // 示例值
          
          // 2. _c_i: 内容块哈希数组
          const _c_i = [
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef"
          ];
          
          // 3. _signature_i_P: Provider 签名
          const _signature_i_P = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00";
          
          // 4. _m_i_hash: 内容块哈希
          const _m_i_hash = "0x3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef";
          
          // 5. _merkleProof: Merkle 证明数组 - 根据 Utility.sol 中的 MerkleProof 结构体定义
          const _merkleProof = [
            {
              label: "0x4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef", // 使用 label 而不是 hash
              posIden: 0 // 使用 posIden 而不是 position
            },
            {
              label: "0x5678901234abcdef5678901234abcdef5678901234abcdef5678901234abcdef",
              posIden: 1
            }
          ];
          
          // 6. _st_erk: Submitted ERK array - according to the SubmittedERK structure defined in Utility.sol
          const _st_erk = [
            {
              position: 1,
              C1_X: ethers.parseEther("1"), // 使用 C1_X 而不是 c_1.X
              C1_Y: ethers.parseEther("2"), // 使用 C1_Y 而不是 c_1.Y
              C2_X: ethers.parseEther("3"), // 使用 C2_X 而不是 c_2.X
              C2_Y: ethers.parseEther("4")  // 使用 C2_Y 而不是 c_2.Y
            },
            {
              position: 2,
              C1_X: ethers.parseEther("5"),
              C1_Y: ethers.parseEther("6"),
              C2_X: ethers.parseEther("7"),
              C2_Y: ethers.parseEther("8")
            }
          ];
          
          // 7. _st_rk: 提交的 RK 数组 - 根据 Utility.sol 中的 SubmittedRK 结构体定义
          const _st_rk = [
            {
              position: 1,
              value: "0x6789012345abcdef6789012345abcdef6789012345abcdef6789012345abcdef" // 使用 value 而不是 rk
            },
            {
              position: 2,
              value: "0x7890123456abcdef7890123456abcdef7890123456abcdef7890123456abcdef"
            }
          ];
          
          // 8. _vpke_proof: VPKE 证明数组 - 根据 Utility.sol 中的 VPKEProof 结构体定义
          const _vpke_proof = [
            {
              position: 1,
              A_X: ethers.parseEther("11"), // 使用 A_X 而不是 a.X
              A_Y: ethers.parseEther("12"), // 使用 A_Y 而不是 a.Y
              B_X: ethers.parseEther("13"), // 使用 B_X 而不是 b.X
              B_Y: ethers.parseEther("14"), // 使用 B_Y 而不是 b.Y
              Z: ethers.parseEther("19")    // 使用 Z 而不是 proof 结构
            },
            {
              position: 2,
              A_X: ethers.parseEther("21"),
              A_Y: ethers.parseEther("22"),
              B_X: ethers.parseEther("23"),
              B_Y: ethers.parseEther("24"),
              Z: ethers.parseEther("29")
            }
          ];
          
          console.log("Parameters prepared");
          
          // Call PoM method
          console.log("\nCall PoM method...");
          try {
            const pomTx = await mainContract.connect(consumer1).PoM(
              _i_j_steps,
              _c_i,
              _signature_i_P,
              _m_i_hash,
              _merkleProof,
              _st_erk,
              _st_rk,
              _vpke_proof
            );
            
            const receipt = await pomTx.wait();
            console.log("PoM transaction status:", receipt.status === 1 ? "Success" : "Failed");
            
            // Verify call after state change
            const providerMisbehaveAfter = await providerContract.GetMyMisbehave(provider1.address);
            const consumerMisbehaveAfter = await consumerContract.GetMyMisbehave(consumer1.address);
            const consumerLedgerAfter = await mainContract.ledger(consumer1.address);
            const providerLedgerAfter = await mainContract.ledger(provider1.address);
            const stateAfterPoM = await mainContract.round();
            
            console.log("\nPoM call after state:");
            console.log("- Provider misbehavior count:", providerMisbehaveAfter.toString());
            console.log("- Provider misbehavior count change:", providerMisbehaveAfter - providerMisbehaveBefore);
            console.log("- Consumer misbehavior count:", consumerMisbehaveAfter.toString());
            console.log("- Consumer misbehavior count change:", consumerMisbehaveAfter - consumerMisbehaveBefore);
            console.log("- Consumer ledger balance:", ethers.formatEther(consumerLedgerAfter), "ETH");
            console.log("- Provider ledger balance:", ethers.formatEther(providerLedgerAfter), "ETH");
            console.log("- Contract state:", stateAfterPoM.toString());
            
            // Calculate refund change
            const consumerLedgerChange = consumerLedgerAfter - consumerLedgerBefore;
            const providerLedgerChange = providerLedgerAfter - providerLedgerBefore;
            
            console.log("\nLedger change analysis:");
            console.log("- Consumer ledger increase:", ethers.formatEther(consumerLedgerChange), "ETH");
            console.log("- Provider ledger change:", ethers.formatEther(providerLedgerChange), "ETH");
            
            // Expected refund calculation: (n - a + 1 - ctr) * payment_PC (refund for unfulfilled blocks)
            const expectedRefund = BigInt(n - a + 1n - ctr) * BigInt(payment_PC);
            console.log("- Expected Consumer refund:", ethers.formatEther(expectedRefund), "ETH");
            
            // Verify results
            console.log("\nPoM verification results:");
            
            // Check if Provider's misbehavior count has increased
            if (providerMisbehaveAfter > providerMisbehaveBefore) {
              console.log("✅ Provider misbehavior count has increased");
              console.log(`From ${providerMisbehaveBefore} to ${providerMisbehaveAfter}`);
            } else if (consumerMisbehaveAfter > consumerMisbehaveBefore) {
              console.log("❌ Consumer misbehavior count increase - PoM verification failed");
              console.log(`From ${consumerMisbehaveBefore} to ${consumerMisbehaveAfter}`);
            } else {
              console.log("❓ No misbehavior count increase");
            }
            
            // Check contract state
            if (stateAfterPoM.toString() === "9") {
              console.log("✅ Contract state has changed to not_sold(9)");
            } else {
              console.log("❌ Contract state has not changed to not_sold(9)");
            }
            
            // Check refund
            if (consumerLedgerChange === expectedRefund) {
              console.log("✅ Consumer received the correct refund");
            } else {
              console.log("❌ Consumer refund amount does not match expected");
              console.log("   Expected:", ethers.formatEther(expectedRefund), "ETH");
              console.log("   Actual:", ethers.formatEther(consumerLedgerChange), "ETH");
            }
            
            // Overall result
            if (
              providerMisbehaveAfter > providerMisbehaveBefore && 
              stateAfterPoM.toString() === "9" && 
              consumerLedgerChange === expectedRefund
            ) {
              console.log("\n✅ PoM test passed: Provider punished, Consumer received refund");
            } else if (consumerMisbehaveAfter > consumerMisbehaveBefore) {
              console.log("\n❌ PoM test failed: Consumer punished - submitted invalid PoM");
            } else {
              console.log("\n❌ PoM test failed: Some expected results not met");
            }
            
          } catch (error) {
            console.log("❌ PoM method call failed:", error.message);
            
            // Check if it is because of timeout
            if (error.message.includes("timeout")) {
              console.log("It might be because the dispute timeout has passed");
              
              // Get current time and timeout time
              const currentTime = Math.floor(Date.now() / 1000);
              const timeoutDispute = await mainContract.timeout_dispute();
              console.log("Current time:", new Date(currentTime * 1000).toLocaleString());
              console.log("Timeout time:", new Date(Number(timeoutDispute) * 1000).toLocaleString());
              
              if (currentTime > timeoutDispute) {
                console.log("✅ Confirmed that the dispute timeout has passed");
              }
            }
            
            // Check if it is because validation failed
            if (error.message.includes("validatePoM")) {
              console.log("PoM validation failed - possibly incorrect parameters");
              
              // Check if Consumer's misbehavior count has increased
              const consumerMisbehaveAfter = await consumerContract.GetMyMisbehave(consumer1.address);
              if (consumerMisbehaveAfter > consumerMisbehaveBefore) {
                console.log("✅ Consumer misbehavior count has increased - submitted invalid PoM");
                console.log(`From ${consumerMisbehaveBefore} to ${consumerMisbehaveAfter}`);
              }
            }
          }
          
        } else {
          console.log("❌ Contract is not in revealed state, cannot test PoM");
        }
      } catch (error) {
        console.log("Error testing PoM method:", error.message);
        // Output more detailed error information
        if (error.data) {
          console.log("Error data:", error.data);
        }
        if (error.reason) {
          console.log("Error reason:", error.reason);
        }
      }

      console.log("----------------------------------------------------------------------\n");

      // 16. Test reset method
      console.log("\nStep 16: Test reset method");
      console.log("----------------------------------------------------------------------");
      console.log("Test contract reset functionality");

      try {
        // Record the state before reset
        const stateBeforeReset = await mainContract.round();
        const providerBeforeReset = await mainContract.provider();
        const consumerBeforeReset = await mainContract.consumer();
        const rootMBeforeReset = await mainContract.root_m();
        
        console.log("\nState before reset:");
        console.log("- Contract state:", stateBeforeReset.toString());
        console.log("- Provider address:", providerBeforeReset);
        console.log("- Consumer address:", consumerBeforeReset);
        console.log("- Content root hash:", rootMBeforeReset);
        
        // Get ledger balance
        const providerLedgerBefore = await mainContract.ledger(provider1.address);
        const consumerLedgerBefore = await mainContract.ledger(consumer1.address);
        console.log("- Provider ledger balance:", ethers.formatEther(providerLedgerBefore), "ETH");
        console.log("- Consumer ledger balance:", ethers.formatEther(consumerLedgerBefore), "ETH");
        
        // Call the reset method
        console.log("\nCalling reset method...");
        const resetTx = await mainContract.connect(provider1).reset();
        const resetReceipt = await resetTx.wait();
        
        // Get gas consumption
        const resetGasUsed = resetReceipt.gasUsed;
        console.log("reset method gas consumption:", resetGasUsed.toString(), "gas");
        console.log("reset transaction status:", resetReceipt.status === 1 ? "✅ Success" : "❌ Failed");
        
        // 验证重置后的状态
        const stateAfterReset = await mainContract.round();
        const providerAfterReset = await mainContract.provider();
        const consumerAfterReset = await mainContract.consumer();
        const rootMAfterReset = await mainContract.root_m();
        
        console.log("\nState after reset:");
        console.log("- Contract state:", stateAfterReset.toString());
        console.log("- Provider address:", providerAfterReset);
        console.log("- Consumer address:", consumerAfterReset);
        console.log("- Content root hash:", rootMAfterReset);
        
        // Check if the ledger balance has been cleared
        const providerLedgerAfter = await mainContract.ledger(provider1.address);
        const consumerLedgerAfter = await mainContract.ledger(consumer1.address);
        console.log("- Provider ledger balance:", ethers.formatEther(providerLedgerAfter), "ETH");
        console.log("- Consumer ledger balance:", ethers.formatEther(consumerLedgerAfter), "ETH");
        
        // Check if the array has been cleared
        let selectedDeliverersCount = 0;
        try {
          while (true) {
            await mainContract.selected_deliverers(selectedDeliverersCount);
            selectedDeliverersCount++;
          }
        } catch (e) {
          // When the array access exceeds the range, an error will be thrown
        }
        
        console.log("\nArray status check:");
        console.log("- selected_deliverers array length:", selectedDeliverersCount);
        
        // 验证结果
        console.log("\nreset verification results:");
        
        // Check if the address has been reset to zero address
        if (providerAfterReset === "0x0000000000000000000000000000000000000000") {
          console.log("✅ Provider address has been reset to zero address");
        } else {
          console.log("❌ Provider address has not been reset");
        }
        
        if (consumerAfterReset === "0x0000000000000000000000000000000000000000") {
          console.log("✅ Consumer address has been reset to zero address");
        } else {
          console.log("❌ Consumer address has not been reset");
        }
        
        // Check if the content hash has been reset
        if (rootMAfterReset === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          console.log("✅ Content root hash has been reset");
        } else {
          console.log("❌ Content root hash has not been reset");
        }
        
        // Check if the ledger balance has been cleared
        if (providerLedgerAfter === 0n) {
          console.log("✅ Provider ledger balance has been cleared");
        } else {
          console.log("Provider ledger balance:", ethers.formatEther(providerLedgerAfter), "ETH");
          console.log("❌ Provider ledger balance has not been cleared");
        }
        
        if (consumerLedgerAfter === 0n) {
          console.log("✅ Consumer ledger balance has been cleared");
        } else {
          console.log("Consumer ledger balance:", ethers.formatEther(consumerLedgerAfter), "ETH");
          console.log("❌ Consumer ledger balance has not been cleared");
        }
        
        // 检查数组是否清空
        if (selectedDeliverersCount === 0) {
          console.log("✅ selected_deliverers array has been cleared");
        } else {
          console.log("❌ selected_deliverers array has not been cleared");
        }
        
        // 检查合约状态是否重置为 sold
        if (stateAfterReset.toString() === "10") { // sold 状态对应的枚举值
          console.log("✅ Contract state has been reset to sold");
        } else {
          console.log("❌ Contract state has not been reset to sold");
        }
        
        // 整体结果
        if (
          providerAfterReset === "0x0000000000000000000000000000000000000000" &&
          consumerAfterReset === "0x0000000000000000000000000000000000000000" &&
          rootMAfterReset === "0x0000000000000000000000000000000000000000000000000000000000000000" &&
          providerLedgerAfter === 0n &&
          consumerLedgerAfter === 0n &&
          selectedDeliverersCount === 0 &&
          stateAfterReset.toString() === "10"
        ) {
          console.log("\n✅ reset test passed: The contract has been successfully reset");
        } else {
          console.log("\n❌ reset test failed: Some states have not been correctly reset");
        }
        
      } catch (error) {
        console.log("Error testing reset method:", error.message);
        // Output more detailed error information
        if (error.data) {
          console.log("Error data:", error.data);
        }
        if (error.reason) {
          console.log("Error reason:", error.reason);
        }
      }

      console.log("----------------------------------------------------------------------\n");

    });
  });
});
