import React, { useState, useRef } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
}

const POS: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, children, position = 'top', delay = 200 }: TooltipProps) {
    const [show, setShow] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    function enter() { timer.current = setTimeout(() => setShow(true), delay); }
    function leave() { clearTimeout(timer.current); setShow(false); }

    return (
        <span className="relative inline-flex" onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
            {children}
            {show && (
                <span className={`absolute z-50 ${POS[position]} pointer-events-none`}>
                    <span className="block whitespace-nowrap rounded-md bg-dark-700 border border-dark-600 px-2.5 py-1.5 text-xs text-slate-200 shadow-lg">
                        {content}
                    </span>
                </span>
            )}
        </span>
    );
}
