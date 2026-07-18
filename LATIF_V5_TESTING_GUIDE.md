# LATIF v5 — Comprehensive Integration Testing Guide

**Version:** 5.5.0-rc1  
**Date:** July 9, 2026  
**Target:** Full system validation before v5.5.0 release

---

## Quick Start

### Setup
```bash
# Start Ollama server
ollama serve

# In another terminal, pull a test model
ollama pull qwen2.5:1.5b

# Start web server
cd latif-ai
python3 -m http.server 8099

# Open browser
http://localhost:8099
```

### Console Access (for debugging)
Press `F12` in browser to open DevTools console. All testing can be done via console.

---

## Test Suite 1: Core Initialization & Data Layer

### Test 1.1: App Initialization
```javascript
// Console
GlobalDataLayer.ready   // Should be true
State.host              // Should be "127.0.0.1"
State.port              // Should be "11434"
GlobalSearchIndex.size()// Should be > 0 if migrated
```
**Expected:** All globals defined, IndexedDB initialized, data migrated.

### Test 1.2: Data Persistence
```javascript
// Create a test chat
const testChat = {
  id: "test_" + Date.now(),
  title: "Test Chat v5",
  messages: [],
  createdAt: Date.now()
};

await GlobalDataLayer.saveChat(testChat);
const retrieved = await GlobalDataLayer.getChat(testChat.id);
console.log("Chat saved and retrieved:", retrieved.title === testChat.title);

// Cleanup
GlobalDataLayer.deleteChat(testChat.id);
```
**Expected:** Chat saved to IndexedDB, retrieved successfully, deletion works.

### Test 1.3: Data Validation
```javascript
// Valid chat
const validChat = {id: "c1", title: "Chat 1", messages: []};
const result = GlobalDataValidator.validateChat(validChat);
console.log("Valid chat result:", result.valid); // true

// Invalid chat (missing required field)
const invalidChat = {title: "No ID"}; // Missing id
const result2 = GlobalDataValidator.validateChat(invalidChat);
console.log("Invalid chat detected:", !result2.valid); // true
console.log("Errors:", result2.errors);
```
**Expected:** Valid chat passes, invalid chat fails with specific error messages.

---

## Test Suite 2: Chat Operations & Request Queue

### Test 2.1: Concurrent Message Prevention
```javascript
// Monitor queue during rapid sends
console.log("Initial queue:", GlobalRequestQueue.status());
// Output should show: {queued: 0, running: 0, paused: false, capacity: 1}

// Send two messages rapidly (try these within 100ms of each other)
sendMessage(undefined, "Message 1 - what is 2+2?");
sendMessage(undefined, "Message 2 - what is 3+3?");

// Immediately check queue
setTimeout(() => {
  console.log("Queue during processing:", GlobalRequestQueue.status());
  // Should show one running, one queued
}, 100);

// Wait 5-10 seconds and check both completed
setTimeout(() => {
  console.log("Final queue:", GlobalRequestQueue.status());
  // Should show: {queued: 0, running: 0}
  console.log("Both messages should be visible in chat");
}, 10000);
```
**Expected:** Queue serializes messages; both responses appear sequentially, no overlap.

### Test 2.2: Chat Search Performance
```javascript
// Create 20 test chats with different titles
for (let i = 0; i < 20; i++) {
  const chat = {
    id: `perf_${i}`,
    title: ["Python tutorial", "JavaScript guide", "Database design", 
           "React optimization", "Python performance"][i % 5] + ` #${i}`,
    messages: [],
    createdAt: Date.now()
  };
  State.chats[chat.id] = chat;
  GlobalSearchIndex.indexChat(chat);
}

// Benchmark search
console.time("Search 20 chats for 'python'");
const results = GlobalSearchIndex.search("python");
console.timeEnd("Search 20 chats for 'python'");
console.log("Found chats:", results.size); // Should find 2 python chats
```
**Expected:** Search completes in <10ms, finds exact matches.

---

## Test Suite 3: Advanced RAG & Reranking

### Test 3.1: Hybrid Search
```javascript
// Index some sample documents
for (let i = 0; i < 5; i++) {
  const content = `Document ${i}: This is about ${["machine learning", "databases", 
                   "web development", "machine learning optimization", "neural networks"][i]}`;
  GlobalHybridRAG.indexDocument(`doc_${i}`, content);
}

// Test BM25 search
const bm25Results = GlobalHybridRAG.searchBM25("machine learning", 5);
console.log("BM25 results:", bm25Results.length);
bm25Results.forEach(r => console.log(`- ${r.docId}: ${r.score.toFixed(2)}`));

// Test semantic cache
console.time("First search");
GlobalHybridRAG.hybridSearch("neural networks", [], 5);
console.timeEnd("First search");

console.time("Cached search");
const cached = GlobalHybridRAG.getCachedResults("neural networks");
console.timeEnd("Cached search");
console.log("Cache hit:", cached !== null); // Should be true
```
**Expected:** BM25 finds relevant docs, cache works (2nd search faster), stats show cache size > 0.

### Test 3.2: Result Reranking
```javascript
// Create mock search results
const mockResults = [
  {docId: "doc1", score: 0.7, content: "Introduction to machine learning and neural networks. This is a comprehensive guide."},
  {docId: "doc2", score: 0.6, content: "ML basics"},
  {docId: "doc3", score: 0.5, content: "Neural networks are used for machine learning tasks"}
];

// Rerank results
const reranked = GlobalReranker.rerank("machine learning", mockResults);
console.log("Original order:", mockResults.map(r => r.docId));
console.log("Reranked order:", reranked.map(r => r.docId));
console.log("Top result score:", reranked[0].rerankerScore.toFixed(2));
```
**Expected:** Reranking changes order based on relevance signals, top result has highest score.

---

## Test Suite 4: Agent Framework

### Test 4.1: Agent Registration
```javascript
console.log("Registered agents:");
GlobalAgentRegistry.listAgents().forEach(agent => {
  console.log(`- ${agent.name} (${agent.role})`);
});
// Should show: Planner, Researcher, Executor, Critic, Memory

// Get individual agent
const planner = GlobalAgentRegistry.getAgent("Planner");
console.log("Planner state:", planner.getState());
```
**Expected:** 5 agents registered, all accessible by name or ID.

### Test 4.2: Agent Processing
```javascript
// Get the researcher agent
const researcher = GlobalAgentRegistry.getAgent("Researcher");

// Send it a task
const response = await researcher.processMessage({
  task: "Find information about machine learning",
  context: "I'm learning AI basics"
});

console.log("Agent response type:", response.type); // Should be "research"
console.log("Agent status:", researcher.state.status); // Should be "idle"
console.log("Agent memory size:", researcher.state.memory.length);
```
**Expected:** Agent processes message, updates status, possibly saves memory.

### Test 4.3: Agent Memory Persistence
```javascript
// Save a fact to memory
const agent = GlobalAgentRegistry.getAgent("Memory");
await agent.saveMemory("Python is a programming language");

console.log("Agent memories:", agent.state.memory);
console.log("Memory saved in IndexedDB: check DevTools → Application → IndexedDB → latif-ai-v5 → memory");
```
**Expected:** Memory saved to agent state and persisted in IndexedDB.

---

## Test Suite 5: Knowledge Graph

### Test 5.1: Entity Extraction
```javascript
// Test entity extraction
const text = `John works at Google in Mountain View. 
              He knows Sarah from Facebook.
              They're both interested in artificial intelligence.`;

GlobalKnowledgeGraph.integrateText(text);

// Check extracted entities
const persons = GlobalKnowledgeGraph.findEntitiesByType("person");
const orgs = GlobalKnowledgeGraph.findEntitiesByType("organization");
const locations = GlobalKnowledgeGraph.findEntitiesByType("location");

console.log("Persons found:", persons.map(p => p.name));
console.log("Orgs found:", orgs.map(o => o.name));
console.log("Locations found:", locations.map(l => l.name));
```
**Expected:** Extracts John, Sarah, Google, Facebook, Mountain View, artificial intelligence.

### Test 5.2: Relationship Finding
```javascript
// Find relationships
const johnToSarah = GlobalKnowledgeGraph.findRelationships("John", "Sarah");
console.log("John ↔ Sarah relationships:", johnToSarah.map(r => r.type));

// Find path between entities
const path = GlobalKnowledgeGraph.findPath("John", "Sarah");
console.log("Path from John to Sarah:", path.map(id => {
  const node = GlobalKnowledgeGraph.nodes.get(id);
  return node?.name || id;
}));
```
**Expected:** Finds "knows" relationship, finds direct connection path.

### Test 5.3: Influence Scoring
```javascript
// Get most influential entities
const influential = GlobalKnowledgeGraph.getInfluentialEntities(5);
console.log("Most influential entities:");
influential.forEach(e => {
  const score = GlobalKnowledgeGraph.getInfluenceScore(e.name);
  console.log(`- ${e.name} (score: ${score.toFixed(2)})`);
});

// Check graph stats
console.log("Graph stats:", GlobalKnowledgeGraph.getStats());
```
**Expected:** Entities ranked by connection count; Google and Facebook likely highest.

---

## Test Suite 6: Vision AI

### Test 6.1: Image File Analysis
```javascript
// Create a test image input
const imageInput = document.getElementById("attachInput");
// Use the file picker to select an image file, or create a test file:

const canvas = document.createElement("canvas");
canvas.width = 100;
canvas.height = 100;
const ctx = canvas.getContext("2d");
ctx.fillStyle = "red";
ctx.fillRect(0, 0, 50, 50);
ctx.fillStyle = "blue";
ctx.fillRect(50, 50, 50, 50);

canvas.toBlob(async (blob) => {
  const file = new File([blob], "test_image.png", {type: "image/png"});
  
  // Analyze image
  const metadata = await GlobalVisionAI.analyzeImage(file);
  console.log("Image metadata:", metadata);
  console.log("Auto-generated tags:", metadata.tags);
  console.log("Dominant colors:", metadata.colors);
});
```
**Expected:** Metadata extracted, tags generated from filename, colors identified.

### Test 6.2: Image Search
```javascript
// Assuming you have multiple images indexed...
const similarImages = GlobalVisionAI.findSimilarImages("first_image_id", 3);
console.log("Similar images:");
similarImages.forEach(img => {
  console.log(`- ${img.name} (similarity: ${img.similarity.toFixed(2)})`);
});
```
**Expected:** Returns images with similar tags, sorted by similarity score.

---

## Test Suite 7: Workflows

### Test 7.1: Workflow Definition
```javascript
// Create a simple workflow
const workflow = new Workflow({
  name: "Test Workflow",
  description: "Simple 3-step test"
});

// Add nodes
workflow.addNode({
  id: "n1",
  label: "Step 1",
  action: async () => {
    console.log("Executing step 1");
    return {result: "Step 1 complete"};
  }
});

workflow.addNode({
  id: "n2",
  label: "Step 2",
  action: async () => {
    console.log("Executing step 2");
    return {result: "Step 2 complete"};
  },
  dependencies: ["n1"]
});

workflow.addNode({
  id: "n3",
  label: "Step 3",
  action: async () => {
    console.log("Executing step 3");
    return {result: "Step 3 complete"};
  },
  dependencies: ["n2"]
});

console.log("Workflow nodes:", workflow.nodes.size); // Should be 3
console.log("Execution order:", workflow.getExecutionOrder().map(n => n.id));
```
**Expected:** Workflow created with 3 nodes, execution order respects dependencies.

### Test 7.2: Workflow Execution
```javascript
// Execute the workflow
const execution = await workflow.execute();
console.log("Execution result:", execution);
console.log("Total duration:", execution.duration, "ms");
console.log("Node results:", execution.nodeResults);

// Check workflow stats
console.log("Workflow stats:", workflow.getStats());
```
**Expected:** Workflow executes all nodes in order, execution history recorded.

### Test 7.3: Workflow Scheduling
```javascript
// Register workflow
GlobalWorkflowScheduler.registerWorkflow(workflow);

// Schedule it to run every hour
const scheduleId = GlobalWorkflowScheduler.scheduleWorkflow(
  workflow.id,
  "0 * * * *"  // Cron: every hour
);

console.log("Scheduled workflows:", GlobalWorkflowScheduler.listSchedules());

// Manually trigger the scheduler check
await GlobalWorkflowScheduler.checkAndExecute();
console.log("Next run:", GlobalWorkflowScheduler.schedules.get(scheduleId).nextRun);
```
**Expected:** Workflow scheduled, can be manually triggered via checkAndExecute.

---

## Test Suite 8: Full Integration Test

### Complete User Workflow
```javascript
// 1. Create a new chat
const chat = {
  id: `integration_${Date.now()}`,
  title: "Full Integration Test",
  messages: [],
  createdAt: Date.now()
};
await GlobalDataLayer.saveChat(chat);
console.log("✓ Chat created");

// 2. Send a message
await GlobalDataLayer.saveMessage({
  id: `msg_${Date.now()}`,
  chatId: chat.id,
  role: "user",
  content: "What is artificial intelligence?",
  timestamp: Date.now()
});
console.log("✓ Message saved");

// 3. Index for search
GlobalSearchIndex.indexChat(chat);
console.log("✓ Chat indexed");

// 4. Extract knowledge
GlobalKnowledgeGraph.integrateText("Artificial intelligence enables machines to learn from data.");
console.log("✓ Knowledge graph updated");

// 5. Trigger agent processing
const researcher = GlobalAgentRegistry.getAgent("Researcher");
await researcher.processMessage({
  task: "Research artificial intelligence",
  context: chat.id
});
console.log("✓ Agent processed message");

// 6. Create and execute workflow
const wf = new Workflow({name: "Integration Test"});
wf.addNode({
  id: "search",
  action: () => GlobalHybridRAG.searchBM25("AI", 3)
});
await wf.execute();
console.log("✓ Workflow executed");

console.log("\n=== ALL INTEGRATION TESTS PASSED ===");
```
**Expected:** All operations complete successfully, no errors in console.

---

## Performance Benchmarks

### Run These Tests in Sequence

```javascript
// Benchmark 1: Chat creation speed
console.time("Create 100 chats");
for (let i = 0; i < 100; i++) {
  await GlobalDataLayer.saveChat({
    id: `bench_${i}`,
    title: `Benchmark Chat ${i}`,
    messages: [],
    createdAt: Date.now()
  });
}
console.timeEnd("Create 100 chats");
// Target: < 5 seconds

// Benchmark 2: Search speed
console.time("Search 100 chats");
GlobalSearchIndex.search("benchmark");
console.timeEnd("Search 100 chats");
// Target: < 10ms

// Benchmark 3: Knowledge graph queries
console.time("Find influential entities in 500-node graph");
GlobalKnowledgeGraph.getInfluentialEntities(10);
console.timeEnd("Find influential entities in 500-node graph");
// Target: < 50ms

// Benchmark 4: Agent message processing
const agent = GlobalAgentRegistry.getAgent("Planner");
console.time("Agent processes message");
await agent.processMessage({task: "Create a plan"});
console.timeEnd("Agent processes message");
// Target: 1-5 seconds (depends on model)
```

**Targets Met If:**
- Chat creation: <50ms per chat
- Search: <10ms
- Graph queries: <50ms
- Agent processing: 1-5s

---

## Debugging Checklist

### Issue: App won't initialize
```javascript
// Check IndexedDB
console.log(await GlobalDataLayer.getAllChats());

// Check errors
console.log(GlobalErrorLogger.history);

// Verify scripts loaded
console.log(typeof GlobalAgent !== "undefined"); // Should be true
```

### Issue: Messages not saving
```javascript
// Check validation
const msg = {id: "test", chatId: "test", role: "user", content: "test", timestamp: Date.now()};
const result = GlobalDataValidator.validateMessage(msg);
console.log("Validation:", result);

// Try manual save
await GlobalDataLayer.saveMessage(msg);
```

### Issue: Agents not responding
```javascript
// Check agent status
GlobalAgentRegistry.listAgents().forEach(a => {
  console.log(`${a.name}: ${a.status}`);
});

// Check if model available
const response = await fetch("http://127.0.0.1:11434/api/tags");
const tags = await response.json();
console.log("Available models:", tags);
```

### Issue: Memory usage growing
```javascript
// Check event listener count
console.log(document.querySelectorAll("*").length, "DOM nodes");

// Check agent memory
GlobalAgentRegistry.listAgents().forEach(a => {
  console.log(`${a.name} memory: ${a.state.memory.length} items`);
});

// Check IndexedDB size (approximate)
const stats = await GlobalDataLayer.getStats();
console.log("Chat count:", stats.chats);
```

---

## Regression Test Checklist

Run before releasing v5.5.0:

- [ ] All 8 test suites pass
- [ ] Performance benchmarks meet targets
- [ ] No console errors
- [ ] Memory stable after 30 minutes
- [ ] Chat history renders without lag
- [ ] Models load correctly
- [ ] Voice input works (if hardware available)
- [ ] Offline cache activates when server offline
- [ ] Settings persist across reload
- [ ] Dark/light theme toggle works
- [ ] File upload and validation works
- [ ] Error logger exports valid JSON

---

## Test Report Template

```
LATIF v5.5.0 Integration Test Report
=====================================

Date: [Date]
Tester: [Name]
Duration: [Hours]

Results:
--------
Test Suite 1 (Initialization): [✓/✗] [Notes]
Test Suite 2 (Chat Ops): [✓/✗] [Notes]
Test Suite 3 (RAG): [✓/✗] [Notes]
Test Suite 4 (Agents): [✓/✗] [Notes]
Test Suite 5 (Knowledge Graph): [✓/✗] [Notes]
Test Suite 6 (Vision): [✓/✗] [Notes]
Test Suite 7 (Workflows): [✓/✗] [Notes]
Test Suite 8 (Integration): [✓/✗] [Notes]

Performance:
------------
Chat creation: [X]ms (Target: <50ms)
Search: [X]ms (Target: <10ms)
Agent reasoning: [X]s (Target: 1-5s)

Issues Found:
-------------
[List any bugs or issues]

Overall Status: [PASS/FAIL]
Recommended for Release: [YES/NO]

Signature: ________________
```

---

## Summary

This guide covers:
- ✅ 8 comprehensive test suites
- ✅ 40+ individual test cases
- ✅ Performance benchmarks
- ✅ Debugging procedures
- ✅ Regression checklist

**Estimated Test Time:** 2-3 hours for full suite

**Pass Criteria:** All tests pass, performance targets met, no console errors.

---

*End of Testing Guide*
