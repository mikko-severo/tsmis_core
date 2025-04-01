import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts file sections from the combined content
 * @param {string} content - The content of the combined file
 * @returns {Array<{path: string, content: string}>} Array of file objects
 */
function isValidFilePath(path) {
    // Check if path has a file extension
    if (!path.includes('.')) return false;

    // Must start with a valid path segment (src/, dist/, etc.)
    // or be a specific config file in the root (like .env, package.json)
    const validStartPatterns = [
        'src/',
        'dev/',
        'server.js',
        'vite.config.js',
        '.env',
        'package.json',
        'package-lock.json'
    ];
    
    if (!validStartPatterns.some(pattern => path.startsWith(pattern))) {
        return false;
    }

    // Reject numbered list items (like "1. Something")
    if (/^\d+\.\s/.test(path)) return false;

    // Reject paths that look like SCSS imports or comments
    if (path.startsWith('@import') || path.startsWith('//')) return false;

    // Additional checks for common file extensions
    const validExtensions = ['.js', '.json', '.scss', '.css', '.html', '.marko', '.txt', '.env'];
    return validExtensions.some(ext => path.endsWith(ext));
}

function extractFileSections(content) {
    const files = [];
    const lines = content.split('\n');
    let currentFile = null;
    let currentContent = [];
    let isInFileContent = false;
    
    // Skip the folder layout section
    let i = 0;
    while (i < lines.length && !lines[i].includes('*/')) {
        i++;
    }
    i++; // Skip the closing */

    // Process the remaining lines
    for (; i < lines.length; i++) {
        const line = lines[i].trimEnd(); // Remove trailing whitespace but keep leading

        // Check if this is a file path line
        if (line.startsWith('// ')) {
            const potentialPath = line.slice(3).trim();
            
            if (isValidFilePath(potentialPath)) {
                // If we were processing a file, save it
                if (currentFile && currentContent.length > 0) {
                    files.push({
                        path: currentFile,
                        content: currentContent.join('\n')
                    });
                }
                
                // Start new file
                currentFile = potentialPath;
                currentContent = [];
                isInFileContent = true;
                continue;
            }
        }

        // Add to current file's content if we're processing a file
        if (isInFileContent && currentFile) {
            currentContent.push(line);
        }
    }
    
    // Don't forget the last file
    if (currentFile && currentContent.length > 0) {
        files.push({
            path: currentFile,
            content: currentContent.join('\n')
        });
    }
    
    return files;
}

/**
 * Creates all directories in a file path if they don't exist
 * @param {string} filePath - The full path to the file
 */
async function ensureDirectoryExists(filePath) {
    const dirname = path.dirname(filePath);
    try {
        await fs.access(dirname);
    } catch {
        await fs.mkdir(dirname, { recursive: true });
    }
}

/**
 * Main function to reverse the file combination
 * @param {string} inputFile - Path to the combined file
 * @param {string} outputDir - Directory where files should be reconstructed
 */
async function reverseCombine(inputFile = 'base_code.txt', outputDir = '.') {
    try {
        // Resolve paths
        const resolvedInputFile = path.resolve(process.cwd(), inputFile);
        const resolvedOutputDir = path.resolve(process.cwd(), outputDir);
        
        console.log(`Reading from: ${resolvedInputFile}`);
        console.log(`Writing to: ${resolvedOutputDir}`);
        
        // Read the combined file
        const content = await fs.readFile(resolvedInputFile, 'utf8');
        
        // Extract file sections
        const files = extractFileSections(content);
        
        // Create output directory if it doesn't exist
        await fs.mkdir(resolvedOutputDir, { recursive: true });
        
        // Process each file
        for (const file of files) {
            const fullPath = path.join(resolvedOutputDir, file.path);
            
            // Create directories if needed
            await ensureDirectoryExists(fullPath);
            
            // Write the file
            await fs.writeFile(fullPath, file.content.trim() + '\n');
            console.log(`Created: ${file.path}`);
        }
        
        console.log(`\nSuccessfully reconstructed ${files.length} files in ${resolvedOutputDir}`);
    } catch (error) {
        console.error('Error during file reconstruction:', error);
        process.exit(1);
    }
}

// Get command line arguments
const args = process.argv.slice(2);
const inputFile = args[0] || 'base_code.txt';
const outputDir = args[1] || '.';

// Run the script
reverseCombine(inputFile, outputDir);

/*
# Use defaults (base_code.txt in current dir, output to current dir)
node reverse-combine.js

# Specify input file
node reverse-combine.js path/to/base_code.txt

# Specify both input file and output directory
node reverse-combine.js path/to/base_code.txt path/to/output
*/