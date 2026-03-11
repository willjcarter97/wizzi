'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface VoiceInputProps {
  onClose: () => void
  onComplete: (updates: unknown[]) => void
}

// VoiceInput uses the browser's built-in Web Speech API for transcription.
// This is free, works offline for transcription, and needs no extra service.
// The transcript is then sent to /api/voice where Claude interprets it.
export default function VoiceInput({ onClose, onComplete }: VoiceInputProps) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing' | 'results'>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [results, setResults] = useState<unknown[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startRecording = useCallback(() => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser. Try Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-GB'
    recognition.interimResults = true    // Show live transcription as the user speaks
    recognition.maxAlternatives = 1
    recognition.continuous = false       // Stop after a pause

    recognition.onstart = () => setPhase('recording')

    // Update the UI with partial results as speech is detected
    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += text
        } else {
          interim += text
        }
      }

      if (final) setTranscript(prev => prev + final)
      setInterimTranscript(interim)
    }

    recognition.onend = () => {
      setInterimTranscript('')
      // If we got something, process it
      if (transcript || recognitionRef.current) {
        handleTranscript(transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        toast.error('Voice recognition error: ' + event.error)
      }
      setPhase('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [transcript])

  const stopRecording = () => {
    recognitionRef.current?.stop()
  }

  const handleTranscript = async (text: string) => {
    if (!text.trim()) {
      setPhase('idle')
      return
    }

    setPhase('processing')

    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })

      const data = await res.json()
      setResults(data.results || [])
      setPhase('results')
    } catch {
      toast.error('Could not process voice input')
      setPhase('idle')
    }
  }

  const handleConfirm = () => {
    onComplete(results)
    toast.success('Pantry updated')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900 rounded-t-2xl border-t border-stone-800 p-6 pb-10 max-w-2xl mx-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      >
        <div className="w-10 h-1 bg-stone-700 rounded-full mx-auto mb-6" />

        {/* Idle: prompt to start */}
        {phase === 'idle' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-100">Voice input</h2>
              <p className="text-sm text-stone-400 mt-1">
                Tell us what changed. For example: "We used half the olive oil" or "Threw away the old cheddar."
              </p>
            </div>
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center mx-auto hover:bg-green-500/30 transition-colors"
            >
              <Mic size={32} className="text-green-400" strokeWidth={1.5} />
            </button>
            <p className="text-xs text-stone-600">Tap to start recording</p>
          </div>
        )}

        {/* Recording: pulsing mic + live transcript */}
        {phase === 'recording' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-100">Listening...</h2>
              <p className="text-sm text-stone-400 mt-1">Speak naturally, then pause.</p>
            </div>

            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center mx-auto voice-recording"
            >
              <Mic size={32} className="text-red-400" strokeWidth={1.5} />
            </button>

            {/* Live transcript preview */}
            <div className="min-h-12 text-sm text-stone-300 text-center leading-relaxed">
              {transcript && <span>{transcript} </span>}
              {interimTranscript && (
                <span className="text-stone-500 italic">{interimTranscript}</span>
              )}
              {!transcript && !interimTranscript && (
                <span className="text-stone-600">...</span>
              )}
            </div>
          </div>
        )}

        {/* Processing: sending to Claude */}
        {phase === 'processing' && (
          <div className="text-center space-y-4 py-4">
            <div className="w-10 h-10 rounded-full border-2 border-green-500/50 border-t-green-400 animate-spin mx-auto" />
            <div>
              <p className="text-stone-100 font-medium">Understanding that...</p>
              <p className="text-xs text-stone-500 mt-1">"{transcript}"</p>
            </div>
          </div>
        )}

        {/* Results: Claude's interpretation for confirmation */}
        {phase === 'results' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-stone-100">Does this look right?</h2>
              <p className="text-xs text-stone-500 mt-0.5">"{transcript}"</p>
            </div>

            <div className="space-y-2">
              {(results as Array<{item_name: string; success: boolean; action?: string}>).map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-stone-800">
                  <div className={`w-2 h-2 rounded-full ${r.success ? 'bg-green-400' : 'bg-red-400'}`} />
                  <p className="text-sm text-stone-200">{r.item_name}</p>
                  {r.action === 'removed' && (
                    <span className="text-xs text-red-400 ml-auto">removed</span>
                  )}
                </div>
              ))}

              {results.length === 0 && (
                <p className="text-sm text-stone-500">No pantry changes detected — try rephrasing.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setTranscript(''); setPhase('idle') }}
                className="flex-1 py-3 rounded-xl bg-stone-800 text-stone-300 text-sm font-medium hover:bg-stone-700 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={handleConfirm}
                disabled={results.length === 0}
                className="flex-1 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-medium hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Check size={16} />
                Confirm
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
