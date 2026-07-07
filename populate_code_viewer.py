#!/usr/bin/env python3
import os
import html
import json

def escape_html(text):
    return html.escape(text)

def get_file_content(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return "# Could not read file"

def generate_section(title, section_id, files, icon="📁"):
    if not files:
        return ""
    
    section_html = f'''
        <div class="section" id="{section_id}">
            <div class="section-title">{icon} {title}</div>
    '''
    
    for filepath in files:
        if os.path.exists(filepath):
            filename = os.path.basename(filepath)
            content = get_file_content(filepath)
            escaped_content = escape_html(content)
            
            section_html += f'''
            <div class="file-container">
                <div class="file-header">
                    📄 {filepath}
                    <button class="copy-btn" onclick="copyToClipboard(`{escaped_content.replace('`', '\\`')}`, this)">📋 Copy</button>
                </div>
                <div class="file-content">{escaped_content}</div>
            </div>
            '''
    
    section_html += '</div>'
    return section_html

def get_file_list(directory, extensions):
    files = []
    if os.path.exists(directory):
        for root, dirs, filenames in os.walk(directory):
            for filename in filenames:
                if any(filename.endswith(ext) for ext in extensions):
                    files.append(os.path.join(root, filename))
    return sorted(files)

# Define file categories
config_files = ['package.json', 'tsconfig.json', 'vite.config.ts', 'drizzle.config.ts']
shared_files = get_file_list('shared', ['.ts'])
server_files = get_file_list('server', ['.ts', '.js'])
client_main_files = ['client/src/main.tsx', 'client/src/App.tsx']
page_files = get_file_list('client/src/pages', ['.tsx', '.ts'])
component_files = [f for f in get_file_list('client/src/components', ['.tsx']) if '/ui/' not in f]
ui_files = get_file_list('client/src/components/ui', ['.tsx'])
hook_lib_files = get_file_list('client/src/hooks', ['.ts', '.tsx']) + get_file_list('client/src/lib', ['.ts'])
store_type_files = get_file_list('client/src/store', ['.ts']) + get_file_list('client/src/types', ['.ts'])

# Generate all sections
sections_html = ""
sections_html += generate_section("Configuration Files", "config", config_files, "⚙️")
sections_html += generate_section("Shared Schema", "shared", shared_files, "🗄️")
sections_html += generate_section("Server Code", "server", server_files, "🖥️")
sections_html += generate_section("Client Main Files", "client-main", client_main_files, "📱")
sections_html += generate_section("Pages", "pages", page_files, "📄")
sections_html += generate_section("Components", "components", component_files, "🧩")
sections_html += generate_section("UI Components", "ui", ui_files, "🎨")
sections_html += generate_section("Hooks & Utilities", "hooks", hook_lib_files, "🔧")
sections_html += generate_section("Stores & Types", "stores", store_type_files, "🏪")

# Read the existing HTML file and inject the code sections
with open('code_viewer.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace the loading div with actual content
html_content = html_content.replace(
    '<div id="code-sections" style="display: none;"></div>',
    f'<div id="code-sections">{sections_html}</div>'
)

# Update the loading script
html_content = html_content.replace(
    "document.getElementById('loading').style.display = 'none';",
    "document.getElementById('loading').style.display = 'none';"
)

# Write the updated HTML
with open('nabornet_complete_code.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("✅ Complete code viewer created: nabornet_complete_code.html")
print("📁 This file contains all your NaborNet source code in a browsable format")
print("🌐 Open it in any web browser to view and copy your code")
