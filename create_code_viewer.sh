#!/bin/bash

# Function to escape HTML
escape_html() {
    sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&#39;/g'
}

# Function to create file section
create_file_section() {
    local filepath="$1"
    local filename=$(basename "$filepath")
    
    if [ -f "$filepath" ]; then
        echo "<div class=\"file-container\">"
        echo "<div class=\"file-header\">📄 $filepath</div>"
        echo "<div class=\"file-content\">"
        cat "$filepath" | escape_html
        echo "</div>"
        echo "</div>"
    fi
}

# Start creating the HTML content
cat > nabornet_complete_code.html << 'HTML_START'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NaborNet - Complete Code Viewer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Monaco', monospace; background: #1a1a1a; color: #e0e0e0; line-height: 1.4; }
        .header { background: #2d2d2d; padding: 20px; border-bottom: 2px solid #444; }
        .header h1 { color: #4a9eff; font-size: 24px; margin-bottom: 5px; }
        .header p { color: #888; font-size: 14px; }
        .content { padding: 20px; }
        .section { margin-bottom: 40px; }
        .section-title { background: linear-gradient(135deg, #4a9eff, #7c3aed); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; font-size: 18px; font-weight: bold; }
        .file-container { background: #2a2a2a; border: 1px solid #444; border-radius: 0 0 8px 8px; margin-bottom: 20px; }
        .file-header { background: #333; padding: 10px 15px; border-bottom: 1px solid #444; font-weight: bold; color: #4a9eff; font-size: 14px; }
        .file-content { padding: 15px; white-space: pre-wrap; font-size: 12px; overflow-x: auto; max-height: 600px; overflow-y: auto; }
        .nav { background: #333; padding: 15px 20px; border-bottom: 1px solid #555; }
        .nav button { background: #444; color: #e0e0e0; border: none; padding: 8px 12px; margin-right: 10px; border-radius: 4px; cursor: pointer; }
        .nav button:hover { background: #555; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📱 NaborNet - Complete Source Code</h1>
        <p>Progressive Web Application for Neighborhood Safety & Community Reporting</p>
    </div>
    
    <div class="nav">
        <button onclick="document.getElementById('config').scrollIntoView()">⚙️ Config</button>
        <button onclick="document.getElementById('shared').scrollIntoView()">🗄️ Shared</button>
        <button onclick="document.getElementById('server').scrollIntoView()">🖥️ Server</button>
        <button onclick="document.getElementById('client').scrollIntoView()">📱 Client</button>
        <button onclick="document.getElementById('pages').scrollIntoView()">📄 Pages</button>
        <button onclick="document.getElementById('components').scrollIntoView()">🧩 Components</button>
    </div>
    
    <div class="content">
HTML_START

# Add Configuration Files Section
echo '<div class="section" id="config"><div class="section-title">⚙️ Configuration Files</div>' >> nabornet_complete_code.html
for file in package.json tsconfig.json vite.config.ts drizzle.config.ts; do
    if [ -f "$file" ]; then
        create_file_section "$file" >> nabornet_complete_code.html
    fi
done
echo '</div>' >> nabornet_complete_code.html

# Add Shared Files
echo '<div class="section" id="shared"><div class="section-title">🗄️ Shared Schema</div>' >> nabornet_complete_code.html
for file in shared/*.ts; do
    if [ -f "$file" ]; then
        create_file_section "$file" >> nabornet_complete_code.html
    fi
done
echo '</div>' >> nabornet_complete_code.html

# Add Server Files
echo '<div class="section" id="server"><div class="section-title">🖥️ Server Code</div>' >> nabornet_complete_code.html
for file in server/*.ts server/*.js; do
    if [ -f "$file" ]; then
        create_file_section "$file" >> nabornet_complete_code.html
    fi
done
echo '</div>' >> nabornet_complete_code.html

# Add Client Main Files
echo '<div class="section" id="client"><div class="section-title">📱 Client Main Files</div>' >> nabornet_complete_code.html
for file in client/src/main.tsx client/src/App.tsx; do
    if [ -f "$file" ]; then
        create_file_section "$file" >> nabornet_complete_code.html
    fi
done
echo '</div>' >> nabornet_complete_code.html

# Add Pages
echo '<div class="section" id="pages"><div class="section-title">📄 Pages</div>' >> nabornet_complete_code.html
find client/src/pages -name "*.tsx" -o -name "*.ts" | sort | while read file; do
    create_file_section "$file" >> nabornet_complete_code.html
done
echo '</div>' >> nabornet_complete_code.html

# Add Components (excluding UI)
echo '<div class="section" id="components"><div class="section-title">🧩 Components</div>' >> nabornet_complete_code.html
find client/src/components -name "*.tsx" | grep -v "/ui/" | sort | while read file; do
    create_file_section "$file" >> nabornet_complete_code.html
done
echo '</div>' >> nabornet_complete_code.html

# Close HTML
cat >> nabornet_complete_code.html << 'HTML_END'
    </div>
</body>
</html>
HTML_END

chmod +x create_code_viewer.sh
