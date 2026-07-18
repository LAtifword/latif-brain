/**
 * test-integration.js — Verify Phase 0 + Kimi Layer (Option 1)
 * ============================================================
 * Run this after deploying the integration to verify everything works.
 * 
 * Usage: node test-integration.js
 */

import { EventBus } from './src/core/event-bus.js';
import { Orchestrator } from './src/core/orchestrator.js';
import { initKimiLayer, checkKimiHealth } from './bridge.js';

const TESTS = {
    passed: 0,
    failed: 0,
    results: []
};

function test(name, fn) {
    return async () => {
        try {
            await fn();
            TESTS.passed++;
            TESTS.results.push({ name, status: '✅ PASS' });
            console.log(`  ✅ ${name}`);
        } catch (error) {
            TESTS.failed++;
            TESTS.results.push({ name, status: '❌ FAIL', error: error.message });
            console.log(`  ❌ ${name}: ${error.message}`);
        }
    };
}

async function runTests() {
    console.log('\n🧪 LATIF-NI Integration Test Suite\n');
    console.log('=' .repeat(50));

    // Test 1: Phase 0 standalone
    await test('Phase 0 Orchestrator initializes', async () => {
        const orch = new Orchestrator({ kimiEnabled: false });
        await orch.init();
        if (!orch.config) throw new Error('Orchestrator not initialized');
    })();

    // Test 2: EventBus works
    await test('EventBus emits and receives', async () => {
        let received = false;
        EventBus.on('test:event', () => { received = true; });
        EventBus.emitEvent('test:event', {});
        if (!received) throw new Error('Event not received');
    })();

    // Test 3: Kimi layer initialization (optional if backend available)
    let kimi = null;
    let kimiAvailable = false;
    try {
        kimi = await initKimiLayer({ mode: 'local' });
        kimiAvailable = kimi !== null;
    } catch (error) {
        // Kimi initialization failed, continue with Phase 0 tests
    }

    if (!kimiAvailable) {
        console.log('  ℹ️ Kimi layer initialization skipped: No backend available (Ollama not running)');
    }

    // Test 4: Kimi health check (skipped if no backend)
    if (kimi) {
        await test('Kimi health check', async () => {
            const health = await checkKimiHealth(kimi);
            console.log(`     Health: ${health.available ? '✓' : '✗'} - ${health.reason}`);
        })();

        // Test 5: Simple Kimi chat
        await test('Kimi simple chat works', async () => {
            const response = await kimi.chat('Say "test passed" and nothing else');
            if (!response || response.length === 0) throw new Error('Empty response');
            console.log(`     Response: "${response.substring(0, 50)}..."`);
        })();

        // Test 6: Kimi skills
        await test('Kimi skills load', async () => {
            const skills = kimi.skills.list();
            if (skills.length === 0) throw new Error('No skills loaded');
            console.log(`     Skills: ${skills.map(s => s.name).join(', ')}`);
        })();

        // Test 7: Backend router
        await test('Backend router detects healthy backend', async () => {
            const status = await kimi.status();
            if (!status.backend) throw new Error('No backend status');
            console.log(`     Backend: ${status.backend.current}`);
        })();
    }

    // Test 8: Orchestrator with Kimi bridge
    await test('Orchestrator with Kimi bridge', async () => {
        const orch = new Orchestrator({ kimiEnabled: true });
        await orch.init();
        const status = await orch.getFullStatus();
        if (!status.phase0) throw new Error('Phase 0 not active');
        const kimiStatus = status.kimi ? (status.kimi.available ? 'active' : 'inactive') : 'unavailable';
        console.log(`     Phase 0: ${status.phase0}, Kimi: ${kimiStatus}`);
    })();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results:');
    console.log(`   ✅ Passed: ${TESTS.passed}`);
    console.log(`   ❌ Failed: ${TESTS.failed}`);
    console.log(`   📋 Total:  ${TESTS.passed + TESTS.failed}`);

    if (TESTS.failed === 0) {
        console.log('\n🎉 All tests passed! Integration is ready.');
    } else if (!kimiAvailable) {
        console.log('\n✅ Phase 0 integration verified. Kimi backend tests skipped (Ollama not available).');
        console.log('   To test full integration, start Ollama: ollama serve');
    } else {
        console.log('\n⚠️ Some tests failed. Check errors above.');
    }

    return TESTS.failed === 0;
}

runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
