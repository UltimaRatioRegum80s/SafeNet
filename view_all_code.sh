#!/bin/bash

echo "=========================================="
echo "         NABORNET APP - ALL CODE"
echo "=========================================="
echo ""

# Function to display file with header
show_file() {
    if [ -f "$1" ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📁 FILE: $1"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat "$1"
        echo ""
        echo ""
    fi
}

echo "🔧 CONFIGURATION FILES"
echo "────────────────────────────────────────"
show_file "package.json"
show_file "tsconfig.json"
show_file "vite.config.ts"
show_file "drizzle.config.ts"

echo "🗄️ SHARED SCHEMA"
echo "────────────────────────────────────────"
show_file "shared/schema.ts"

echo "⚙️ SERVER CODE"
echo "────────────────────────────────────────"
for file in server/*.ts server/*.js; do
    show_file "$file"
done

echo "🖥️ CLIENT - MAIN FILES"
echo "────────────────────────────────────────"
show_file "client/src/main.tsx"
show_file "client/src/App.tsx"

echo "📄 CLIENT - PAGES"
echo "────────────────────────────────────────"
for file in client/src/pages/*.tsx client/src/pages/*/*.tsx; do
    show_file "$file"
done

echo "🧩 CLIENT - COMPONENTS"
echo "────────────────────────────────────────"
for file in client/src/components/*.tsx; do
    show_file "$file"
done

echo "🎨 CLIENT - UI COMPONENTS"
echo "────────────────────────────────────────"
for file in client/src/components/ui/*.tsx; do
    show_file "$file"
done

echo "🔧 CLIENT - HOOKS & UTILITIES"
echo "────────────────────────────────────────"
for file in client/src/hooks/*.ts client/src/hooks/*.tsx client/src/lib/*.ts; do
    show_file "$file"
done

echo "🏪 CLIENT - STORES & TYPES"
echo "────────────────────────────────────────"
for file in client/src/store/*.ts client/src/types/*.ts; do
    show_file "$file"
done

echo "=========================================="
echo "           END OF CODE DISPLAY"
echo "=========================================="
