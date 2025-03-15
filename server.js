// Simple HTTP server to serve the HTML viewer and XML files
import { serve } from "bun";
import fs from "fs";
import path from "path";

const PORT = 3001;

// MIME types mapping
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;

    // Default to index.html for root path
    if (filePath === "/") {
      filePath = "/index.html";
    }

    // Resolve file path from current directory
    const fullPath = path.join(process.cwd(), filePath);

    try {
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return new Response("File not found", { status: 404 });
      }

      const fileExt = path.extname(fullPath);
      const contentType = MIME_TYPES[fileExt] || "application/octet-stream";

      // Read file content
      const content = fs.readFileSync(fullPath);

      return new Response(content, {
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error(`Error serving ${fullPath}:`, error);
      return new Response("Server error", { status: 500 });
    }
  },
});

console.log(`Server running at http://localhost:${PORT}/`);
