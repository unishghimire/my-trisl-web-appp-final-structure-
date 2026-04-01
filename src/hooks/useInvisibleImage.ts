import React, { useCallback, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { useNotification } from '../context/NotificationContext';

interface UseInvisibleImageOptions {
    onUploadSuccess: (url: string) => void;
    onUploadStart?: () => void;
    onUploadEnd?: () => void;
    onError?: (error: string) => void;
    folder?: string;
}

export const useInvisibleImage = (options: UseInvisibleImageOptions) => {
    const { onUploadSuccess, onUploadStart, onUploadEnd, onError, folder = 'gallery' } = options;
    const { showToast } = useNotification();
    const [isProcessing, setIsProcessing] = useState(false);

    const processAndUpload = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            const err = 'Only image files are allowed';
            showToast(err, 'error');
            onError?.(err);
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            const err = 'Only JPG, PNG, and WEBP are allowed';
            showToast(err, 'error');
            onError?.(err);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            const err = 'File size too large. Max 5MB allowed.';
            showToast(err, 'error');
            onError?.(err);
            return;
        }

        onUploadStart?.();
        setIsProcessing(true);

        try {
            // Compress image
            const compressionOptions = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true
            };
            const compressedFile = await imageCompression(file, compressionOptions);

            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(compressedFile);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                // Upload to server
                const token = localStorage.getItem('token');
                const response = await fetch('/api/process-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ base64: base64data, folder })
                });

                const result = await response.json();
                if (result.success) {
                    onUploadSuccess(result.url);
                    showToast('Image processed successfully!', 'success');
                } else {
                    const err = result.message || 'Failed to process image';
                    showToast(err, 'error');
                    onError?.(err);
                }
                onUploadEnd?.();
                setIsProcessing(false);
            };
        } catch (error) {
            console.error('Image processing error:', error);
            const err = 'Error processing image';
            showToast(err, 'error');
            onError?.(err);
            onUploadEnd?.();
            setIsProcessing(false);
        }
    }, [onUploadSuccess, onUploadStart, onUploadEnd, onError, folder, showToast]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) processAndUpload(file);
            }
        }
    }, [processAndUpload]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                processAndUpload(file);
            }
        }
    }, [processAndUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    return {
        handlePaste,
        handleDrop,
        handleDragOver,
        processAndUpload,
        isProcessing
    };
};
