import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import fs from "fs";
import multer from "multer";
import { getFirestore } from "firebase-admin/firestore";
import apiRoutes from "./src/server/routes";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (Singleton check to avoid multiple inits)
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
}

const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
const bucket = admin.storage().bucket();
const JWT_SECRET = process.env.JWT_SECRET || "nexplay-secret-key-2026";

// Multer setup for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed."));
    }
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- Secure NexPlay Backend API (V2) ---
  app.use("/api/v2", apiRoutes);

  // Middleware to authenticate JWT token (V1)
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      req.user = { userId: decoded.uid, email: decoded.email, username: decoded.username, role: decoded.role };
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  };

  // --- Auth API Routes ---
  // ... (existing routes)

  // Register
  app.post("/api/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }

      // Check if user exists (email or username)
      const emailCheck = await db.collection("users").where("email", "==", email).get();
      if (!emailCheck.empty) {
        return res.status(400).json({ success: false, message: "Email already registered" });
      }

      const usernameCheck = await db.collection("users").where("username", "==", username).get();
      if (!usernameCheck.empty) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user in Firestore
      const userRef = db.collection("users").doc();
      const uid = userRef.id;

      const newUser = {
        uid,
        email,
        username,
        password: hashedPassword, // Store hash
        role: "player",
        balance: 0,
        totalEarnings: 0,
        inGameId: "",
        teamName: "",
        phone: "",
        isBanned: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set(newUser);

      // Create public profile
      await db.collection("users_public").doc(uid).set({
        uid,
        username,
        totalEarnings: 0,
        inGameId: "",
        role: "player",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Generate token
      const token = jwt.sign({ uid, email, username, role: "player" }, JWT_SECRET, { expiresIn: "7d" });

      res.status(201).json({ success: true, message: "User registered successfully", token, user: { uid, email, username, role: "player" } });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Login
  app.post("/api/login", async (req, res) => {
    try {
      const { identifier, password } = req.body; // identifier can be email or username

      if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Identifier and password are required" });
      }

      // Find user by email or username
      let userSnap = await db.collection("users").where("email", "==", identifier).get();
      if (userSnap.empty) {
        userSnap = await db.collection("users").where("username", "==", identifier).get();
      }

      if (userSnap.empty) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      const userData = userSnap.docs[0].data();
      const uid = userSnap.docs[0].id;

      if (userData.isBanned) {
        return res.status(403).json({ success: false, message: "Account is banned" });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, userData.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      // Generate token
      const token = jwt.sign({ uid, email: userData.email, username: userData.username, role: userData.role }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ 
        success: true, 
        message: "Login successful", 
        token, 
        user: { 
          uid, 
          email: userData.email, 
          username: userData.username, 
          role: userData.role 
        } 
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Forgot Password
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });

      const userSnap = await db.collection("users").where("email", "==", email).get();
      if (userSnap.empty) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // In a real app, send an email with a reset link containing a token
      // For this demo, we'll just return success
      res.json({ success: true, message: "Password reset link sent to your email" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Reset Password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ success: false, message: "Token and new password are required" });

      // Verify token (in a real app, this would be a specific reset token)
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const uid = decoded.uid;

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.collection("users").doc(uid).update({ password: hashedPassword });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
  });

  // Verify Token
  app.get("/api/me", authenticateToken, async (req: any, res) => {
    try {
      const userSnap = await db.collection("users").doc(req.user.userId).get();
      if (!userSnap.exists) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const userData = userSnap.data();
      res.json({ 
        success: true, 
        user: { 
          uid: req.user.userId, 
          email: userData?.email, 
          username: userData?.username, 
          role: userData?.role 
        } 
      });
    } catch (error: any) {
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  });

  // --- Media API Routes ---

  // Upload Image
  app.post("/api/upload-image", authenticateToken, upload.single("image"), async (req: any, res) => {
    try {
      const uid = req.user.userId;

      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, "_")}`;
      const file = bucket.file(`gallery/${fileName}`);

      // Upload to Firebase Storage
      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      // Make file public (optional, but needed for direct URL)
      // Alternatively, use signed URL or public URL if bucket is public
      // In this environment, we'll use the standard public URL format
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

      // Save to Firestore
      const mediaRef = db.collection("media").doc();
      const mediaData = {
        id: mediaRef.id,
        userId: uid,
        url: publicUrl,
        fileName: fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await mediaRef.set(mediaData);

      res.status(201).json({ success: true, url: publicUrl, media: mediaData });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // Get All Media
  app.get("/api/media", async (req, res) => {
    try {
      const mediaSnap = await db.collection("media").orderBy("createdAt", "desc").get();
      const mediaList = mediaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, media: mediaList });
    } catch (error: any) {
      console.error("Fetch media error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Process Base64 Image
  app.post("/api/process-image", authenticateToken, async (req: any, res) => {
    try {
      const { base64, folder = "gallery" } = req.body;
      const uid = req.user.userId;

      if (!base64) {
        return res.status(400).json({ success: false, message: "No image data provided" });
      }

      // Extract base64 data and metadata
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ success: false, message: "Invalid base64 format" });
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      // Validate mime type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ success: false, message: "Invalid file type. Only JPG, PNG, and WEBP are allowed." });
      }

      // Validate size (5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: "File size too large. Max 5MB allowed." });
      }

      const extension = mimeType.split('/')[1];
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const file = bucket.file(`${folder}/${fileName}`);

      // Upload to Firebase Storage
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
        },
      });

      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

      // Save to Firestore media collection (optional, but good for tracking)
      const mediaRef = db.collection("media").doc();
      const mediaData = {
        id: mediaRef.id,
        userId: uid,
        url: publicUrl,
        fileName: fileName,
        fileSize: buffer.length,
        mimeType: mimeType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await mediaRef.set(mediaData);

      res.status(201).json({ success: true, url: publicUrl });
    } catch (error: any) {
      console.error("Process image error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Delete media
app.delete('/api/media/:id', authenticateToken, async (req: any, res) => {
    try {
        const mediaId = req.params.id;
        const mediaDoc = await db.collection('media').doc(mediaId).get();

        if (!mediaDoc.exists) {
            return res.status(404).json({ success: false, message: 'Media not found' });
        }

        const mediaData = mediaDoc.data();
        if (mediaData?.userId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Delete from Firestore
        await db.collection('media').doc(mediaId).delete();

        // Note: We could also delete from Storage here, but it requires the file path
        // For now, we'll just remove the metadata from Firestore

        res.json({ success: true, message: 'Media deleted successfully' });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

  // --- Global Error Handler ---
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("🔥 Global Error Caught:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR"
    });
  });

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
