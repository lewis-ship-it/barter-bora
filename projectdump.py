import os

# Configuration: Files and folders to skip[cite: 1, 2]
IGNORE_LIST = {
    'node_modules', '.git', '__pycache__', 'vendor', 
     'dump_project.py', 'project_dump.txt',
    '.DS_Store', 'composer.lock', 'package-lock.json'
}

# Supported file extensions
EXTENSIONS = {'.js', '.html', '.css', '.php', '.sql', '.json'}

def dump_project():
    output_file = "project_dump.txt"
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("BARTER BORA - FULL PROJECT DUMP\n")
        f.write("="*30 + "\n\n")
        
        for root, dirs, files in os.walk("."):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_LIST]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXTENSIONS) and file not in IGNORE_LIST:
                    file_path = os.path.join(root, file)
                    
                    f.write(f"\n{'#'*80}\n")
                    f.write(f"FILE: {file_path}\n")
                    f.write(f"{'#'*80}\n\n")
                    
                    try:
                        with open(file_path, "r", encoding="utf-8") as code_file:
                            f.write(code_file.read())
                            f.write("\n")
                    except Exception as e:
                        f.write(f"[ERROR READING FILE: {e}]\n")

    print(f"Successfully dumped project into {output_file}")

if __name__ == "__main__":
    dump_project()