#!/bin/bash
# rollback.sh — Remove Kimi integration and restore Phase 0 only
# ================================================================
# Usage: bash rollback.sh
# This safely removes the Kimi layer without touching Phase 0 code.

echo "🔄 LATIF-NI Kimi Integration Rollback"
echo "======================================"
echo ""

# Confirm
echo "⚠️  This will remove the Kimi integration layer."
echo "    Your Phase 0 code in src/ will NOT be touched."
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled."
    exit 0
fi

echo ""
echo "📦 Removing Kimi integration files..."

# Remove Kimi integration directory
rm -rf kimi-integration/
rm -f bridge.js
rm -f test-integration.js
rm -f .env.kimi

echo "✅ Removed: kimi-integration/"
echo "✅ Removed: bridge.js"
echo "✅ Removed: test-integration.js"
echo "✅ Removed: .env.kimi"

echo ""
echo "📝 Note: You need to manually revert the 3 lines in src/core/orchestrator.js:"
echo "   1. Remove: import { initKimiLayer... } from '../../bridge.js';"
echo "   2. Remove: this.kimi = null;"
echo "   3. Remove: the initKimiLayer() block in init()"
echo ""
echo "🎉 Rollback complete. Phase 0 is restored."
