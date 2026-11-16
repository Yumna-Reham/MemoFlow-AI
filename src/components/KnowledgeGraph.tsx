'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, FileText, ArrowRight, Brain } from 'lucide-react';
import { Note } from '../mockData';

interface KnowledgeGraphProps {
  notes: Note[];
  onSelectNote: (noteId: string) => void;
}

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  type: string;
}

interface Link {
  source: string;
  target: string;
}

export default function KnowledgeGraph({ notes, onSelectNote }: KnowledgeGraphProps) {
  // SVG size boundaries
  const width = 600;
  const height = 400;

  // Nodes with initial center coordinates
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'react-18-ref', label: 'React Concurrent Renderer', x: 220, y: 150, color: '#3B82F6', type: 'note' },
    { id: 'link-youtube', label: 'YouTube: Framer Masterclass', x: 120, y: 240, color: '#EF4444', type: 'youtube' },
    { id: 'voice-note-idea', label: 'ADHD Workspace Audio', x: 380, y: 110, color: '#10B981', type: 'voice' },
    { id: 'ai-prompt-eng', label: 'AI Chain of Thought Prompting', x: 420, y: 280, color: '#8B5CF6', type: 'chatgpt' },
    { id: 'whatsapp-chat', label: 'WhatsApp Vector database discussion', x: 280, y: 320, color: '#22C55E', type: 'whatsapp' },
    { id: 'mktg-strategy', label: 'Q3 Marketing Launch Framework', x: 480, y: 190, color: '#EC4899', type: 'pdf' },
  ]);

  const links: Link[] = [
    { source: 'react-18-ref', target: 'link-youtube' },
    { source: 'react-18-ref', target: 'voice-note-idea' },
    { source: 'ai-prompt-eng', target: 'whatsapp-chat' },
    { source: 'ai-prompt-eng', target: 'mktg-strategy' },
    { source: 'whatsapp-chat', target: 'react-18-ref' },
    { source: 'voice-note-idea', target: 'ai-prompt-eng' },
  ];

  const [activeNode, setActiveNode] = useState<Node | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Mouse drag coordinates simulator
  const handleMouseDown = (nodeId: string) => {
    setDraggedNodeId(nodeId);
    const selected = nodes.find(n => n.id === nodeId);
    if (selected) setActiveNode(selected);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!draggedNodeId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes(prev =>
      prev.map(n => (n.id === draggedNodeId ? { ...n, x, y } : n))
    );
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  // Auto layout attraction simulations (brings nodes back to boundaries if dragged outside)
  useEffect(() => {
    if (draggedNodeId) return;

    const interval = setInterval(() => {
      // Small gravitational pull towards center point of workspace
      const centerX = width / 2;
      const centerY = height / 2;

      setNodes(prev =>
        prev.map(n => {
          const dx = centerX - n.x;
          const dy = centerY - n.y;
          // Apply damp coefficient
          return {
            ...n,
            x: n.x + dx * 0.005,
            y: n.y + dy * 0.005,
          };
        })
      );
    }, 40);

    return () => clearInterval(interval);
  }, [draggedNodeId]);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar bg-memobg">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-memotext">Knowledge Graph</h1>
        <p className="text-xs text-memotextsec">Drag nodes and visual links to explore conceptual connections.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* SVG Container */}
        <div className="lg:col-span-8 bg-white border border-memoborder rounded-3xl p-4 shadow-sm relative overflow-hidden flex items-center justify-center">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto bg-slate-50/50 rounded-2xl border border-slate-100 cursor-grab active:cursor-grabbing select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Draw Links */}
            {links.map((link, idx) => {
              const src = nodes.find(n => n.id === link.source);
              const tgt = nodes.find(n => n.id === link.target);
              if (!src || !tgt) return null;
              return (
                <line
                  key={idx}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="#E2E8F0"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Draw Nodes */}
            {nodes.map((node) => {
              const active = activeNode?.id === node.id;
              return (
                <g key={node.id} className="cursor-pointer">
                  {/* Outer Pulsing glow ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={active ? 20 : 15}
                    fill={node.color}
                    opacity="0.15"
                    className={active ? 'animate-ping' : ''}
                  />

                  {/* Base Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={active ? 12 : 9}
                    fill={node.color}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    onMouseDown={() => handleMouseDown(node.id)}
                    className="shadow-sm transition-all"
                  />

                  {/* Name Label */}
                  <text
                    x={node.x}
                    y={node.y + 24}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-memotext pointer-events-none select-none"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-memoborder rounded-3xl p-5 shadow-sm space-y-4">
            <span className="text-[10px] font-bold text-memotextsec uppercase tracking-wider block">Note inspector</span>
            
            {activeNode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: activeNode.color }}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-sm text-memotext leading-tight">{activeNode.label}</h3>
                </div>

                <p className="text-xs text-memotextsec leading-relaxed">
                  Hover and drag nodes to test dynamic force coordinates. Click below to open and edit details.
                </p>

                <button
                  onClick={() => onSelectNote(activeNode.id)}
                  className="w-full py-2.5 bg-memoprimary hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 transition-all hover:scale-102 cursor-pointer"
                >
                  <span>Open Core Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-memotextsec space-y-2">
                <Sparkles className="w-5 h-5 text-memoprimary mx-auto opacity-40 animate-pulse" />
                <p>Click on any node in the left SVG layout to inspect its connections.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
