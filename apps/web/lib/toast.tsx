'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
    id: string;
    message: string;
    variant: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, variant: Toast['variant']) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, variant: Toast['variant']) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, variant }]);

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }

    return {
        success: (message: string) => context.addToast(message, 'success'),
        error: (message: string) => context.addToast(message, 'error'),
        warning: (message: string) => context.addToast(message, 'warning'),
        info: (message: string) => context.addToast(message, 'info'),
    };
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const variantStyles = {
        success: 'bg-[#059833] text-white',
        error: 'bg-red-600 text-white',
        warning: 'bg-yellow-500 text-white',
        info: 'bg-blue-600 text-white',
    };

    const iconPaths = {
        success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    };

    return (
        <div
            className={`${variantStyles[toast.variant]} rounded-lg shadow-lg p-4 flex items-center gap-3 animate-slide-in-right min-w-[300px]`}
        >
            <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path d={iconPaths[toast.variant]} />
            </svg>

            <p className="flex-1 text-sm font-medium">{toast.message}</p>

            <button
                onClick={() => onRemove(toast.id)}
                className="flex-shrink-0 hover:opacity-70 transition-opacity"
                aria-label="Close"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
