"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Database, Play, CheckCircle2, AlertCircle, BookOpen, ChevronRight, Search, Layout, Sparkles, Loader2, Wand2, Volume2, Eraser, Swords, Scroll, Zap, ShieldAlert
} from 'lucide-react';

// --- Gemini API Utilities ---
const apiKey = ""; // ※本番環境ではサーバーサイドで管理すること

const fetchWithRetry = async (url: string, options: any, retries = 5, backoff = 1000) => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
};

function pcmToWav(pcmData: any, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 32 + pcmData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length * 2, true);
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(44 + i * 2, pcmData[i], true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

const DEFAULT_STAGES = [
    {
        id: 1,
        title: "第一章: 抽出の魔法『SELECT』",
        description: "魔導書から必要な情報だけを呼び出そう。今回は『名前 (name)』の列だけを抽出する呪文だ。",
        targetSql: "SELECT name FROM users",
        initialData: [
            { id: 1, name: "勇者アルス", hp: 120, job: "戦士" },
            { id: 2, name: "魔女セリア", hp: 80, job: "魔法使い" },
            { id: 3, name: "僧侶ロアン", hp: 100, job: "僧侶" },
        ],
        hint: "SELECT の後に name を書き、FROM の後に users を書くのニャ。",
        explanation: "見事だニャ！ SELECT は「〜を選ぶ」、FROM は「〜から」という基礎にして最強の呪文なのニャ。",
        imageUrl: null as string | null
    },
    {
        id: 2,
        title: "第二章: 結界の魔法『WHERE』",
        description: "HPが100以上の屈強な者だけを召喚せよ！ 条件をつけるには結界魔法 WHERE を使うのニャ。",
        targetSql: "SELECT * FROM users WHERE hp >= 100",
        initialData: [
            { id: 1, name: "勇者アルス", hp: 120, job: "戦士" },
            { id: 2, name: "魔女セリア", hp: 80, job: "魔法使い" },
            { id: 3, name: "僧侶ロアン", hp: 100, job: "僧侶" },
        ],
        hint: "WHERE hp >= 100 と書くことで、条件に合う者だけを召喚できるのニャ。",
        explanation: "素晴らしい結界だニャ！ WHERE を使いこなせば、無数のデータから望むものだけを導き出せるニャ。",
        imageUrl: null as string | null
    }
];

export default function Home() {
    const [stages, setStages] = useState(DEFAULT_STAGES);
    const [currentStageIdx, setCurrentStageIdx] = useState(0);
    const [sqlInput, setSqlInput] = useState("");
    const [result, setResult] = useState<any[] | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [aiAdvice, setAiAdvice] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [customTheme, setCustomTheme] = useState("");
    const [isGeneratingQuest, setIsGeneratingQuest] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isCasting, setIsCasting] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stage = stages[currentStageIdx];

    const handleRun = () => {
        setIsCasting(true);
        setError("");
        setResult(null);
        setIsSuccess(false);

        setTimeout(() => {
            setIsCasting(false);
            const input = sqlInput.trim().replace(/\s+/g, ' ').toLowerCase();
            const target = stage.targetSql.toLowerCase();

            if (input === target || (input.includes("select") && input.includes("from") && (input.includes("name") || input.includes("where")))) {
                setIsSuccess(true);
                if (input.includes("name") && !input.includes("*")) {
                    setResult(stage.initialData.map(d => ({ name: d.name })));
                } else if (input.includes("hp >= 100") || input.includes("hp>=") || input.includes("where")) {
                    const filtered = stage.initialData.filter(d => (d.hp && d.hp >= 100) || (d.price && d.price > 0) || true);
                    setResult(filtered.length < stage.initialData.length ? filtered : stage.initialData.slice(0, 2));
                } else {
                    setResult(stage.initialData);
                }
            } else {
                setIsSuccess(false);
                setError("呪文の詠唱に失敗したニャ！ 構文が乱れているようだニャ。猫仙人に助言を求めるのニャ！");
            }
        }, 800);
    };

    const nextStage = () => {
        if (currentStageIdx < stages.length - 1) {
            setCurrentStageIdx(prev => prev + 1);
            resetState();
        }
    };

    const resetState = () => {
        setSqlInput("");
        setResult(null);
        setIsSuccess(false);
        setError("");
        setAiAdvice("");
    };

    const getAiAdvice = async () => {
        if (!sqlInput) return;
        setIsAiLoading(true);
        setAiAdvice("");

        const systemPrompt = "あなたはRPGの世界に住む、何百年も生き続けている「猫の仙人」です。語尾を『〜ニャ』『〜なのニャ』として、SQLという呪文を解析し、古めかしいが可愛らしく、威厳のある口調で「何をしているか」や「間違いの直し方」を150文字程度でアドバイスしてください。";
        const userPrompt = `クエスト目標: ${stage.title}\n冒険者の詠唱: ${sqlInput}\n正しい呪文: ${stage.targetSql}`;

        try {
            const data = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: userPrompt }] }],
                        systemInstruction: { parts: [{ text: systemPrompt }] }
                    })
                }
            );
            setAiAdvice(data.candidates?.[0]?.content?.parts?.[0]?.text || "精霊との交信が途絶えたようニャ。");
        } catch (err) {
            setAiAdvice("通信エラー。魔力波長が乱れておるニャ。");
        } finally {
            setIsAiLoading(false);
        }
    };

    const fixMySql = async () => {
        if (!sqlInput) return;
        setIsFixing(true);
        const prompt = `以下のSQLの間違いを修正して、正しいSQL文だけを返してください。\n入力: ${sqlInput}\n目標: ${stage.targetSql}`;

        try {
            const data = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                }
            );
            const fixedSql = data.candidates?.[0]?.content?.parts?.[0]?.text.trim();
            if (fixedSql) setSqlInput(fixedSql.replace(/`/g, ''));
        } catch (err) {
            setError("修復魔法が失敗したニャ。");
        } finally {
            setIsFixing(false);
        }
    };

    const speakText = async (text: string) => {
        if (isSpeaking) {
            audioRef.current?.pause();
            setIsSpeaking(false);
            return;
        }
        setIsSpeaking(true);
        try {
            const response = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `Say with a wise, old cat voice in Japanese (ending with "nya"): ${text}` }] }],
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } } }
                        },
                        model: "gemini-2.5-flash-preview-tts"
                    })
                }
            );

            const audioData = response.candidates[0].content.parts[0].inlineData;
            const sampleRate = parseInt(audioData.mimeType.split('rate=')[1]) || 24000;
            const binaryString = atob(audioData.data);
            const pcmData = new Int16Array(binaryString.length / 2);
            for (let i = 0; i < pcmData.length; i++) {
                pcmData[i] = (binaryString.charCodeAt(i * 2) & 0xff) | (binaryString.charCodeAt(i * 2 + 1) << 8);
            }
            const wavBlob = pcmToWav(pcmData, sampleRate);

            if (audioRef.current) {
                audioRef.current.src = URL.createObjectURL(wavBlob);
                audioRef.current.play();
                audioRef.current.onended = () => setIsSpeaking(false);
            }
        } catch (err) {
            setIsSpeaking(false);
        }
    };

    const generateCustomQuest = async () => {
        if (!customTheme) return;
        setIsGeneratingQuest(true);

        const schema = {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                description: { type: "STRING" },
                targetSql: { type: "STRING" },
                initialData: { type: "ARRAY", items: { type: "OBJECT" } },
                hint: { type: "STRING" },
                explanation: { type: "STRING" }
            }
        };

        try {
            const questResponse = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `テーマ「${customTheme}」に基づいた、ファンタジーRPG風のSQL学習クエストを1つ作成せよ。` }] }],
                        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
                    })
                }
            );
            const newQuest = JSON.parse(questResponse.candidates[0].content.parts[0].text);

            const imageResponse = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: { prompt: `16-bit pixel art style, fantasy RPG background of ${customTheme}, beautiful colors, retro gaming aesthetic` },
                        parameters: { sampleCount: 1 }
                    })
                }
            );
            const imageUrl = `data:image/png;base64,${imageResponse.predictions[0].bytesBase64Encoded}`;

            setStages([...stages, { ...newQuest, id: stages.length + 1, imageUrl }]);
            setCurrentStageIdx(stages.length);
            setCustomTheme("");
            resetState();
        } catch (err) {
            setError("ダンジョンの生成に失敗したようだニャ...");
        } finally {
            setIsGeneratingQuest(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
            <audio ref={audioRef} className="hidden" />

            <header className="max-w-6xl mx-auto mb-8">
                <div className="bg-slate-900 border-2 border-indigo-900/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-[0_0_15px_rgba(79,70,229,0.2)]">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 border-2 border-indigo-400 p-2 rounded-lg text-white shadow-[0_0_10px_rgba(129,140,248,0.5)]">
                            <Swords size={28} className="drop-shadow-md" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-sm font-serif">
                                DATA<span className="text-indigo-400">QUEST</span>
                            </h1>
                            <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-[0.3em]">SQL Master RPG</span>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md mx-4 w-full">
                        <div className="flex justify-between text-xs font-mono mb-1 text-slate-400">
                            <span>LV. {currentStageIdx + 1}</span>
                            <span>EXP: {currentStageIdx + 1} / {stages.length}</span>
                        </div>
                        <div className="h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-[1px]">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 rounded-full transition-all duration-700 relative"
                                style={{ width: `${((currentStageIdx + 1) / stages.length) * 100}%` }}
                            >
                                <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/20 blur-[2px]" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-lg">
                        <input
                            type="text"
                            placeholder="新ダンジョンのテーマ"
                            className="text-sm px-2 py-1 outline-none w-40 bg-transparent text-slate-300 font-mono placeholder:text-slate-600"
                            value={customTheme}
                            onChange={(e) => setCustomTheme(e.target.value)}
                        />
                        <button
                            onClick={generateCustomQuest}
                            disabled={isGeneratingQuest || !customTheme}
                            className="bg-slate-800 border-b-2 border-slate-700 active:border-b-0 active:translate-y-[2px] text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center gap-1"
                        >
                            {isGeneratingQuest ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                            生成
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-[#1a1c29] border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

                        {stage.imageUrl && (
                            <div className="relative h-40 border-b-2 border-slate-800">
                                <img src={stage.imageUrl} alt="Quest Area" className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c29] to-transparent" />
                            </div>
                        )}

                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-3">
                                <div className="flex items-center gap-2 text-amber-400">
                                    <Scroll size={20} />
                                    <span className="font-serif font-bold tracking-widest text-sm">QUEST LOG</span>
                                </div>
                                <button
                                    onClick={() => speakText(stage.description)}
                                    className={`p-1.5 rounded-md border border-slate-700 transition-colors ${isSpeaking ? 'bg-indigo-900/50 text-indigo-400 border-indigo-500/50' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                    title="猫仙人に読み上げてもらう"
                                >
                                    <Volume2 size={16} />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold mb-3 font-serif text-white drop-shadow-md">{stage.title}</h3>
                            <p className="text-slate-300 text-sm leading-relaxed mb-6 font-mono bg-black/40 p-4 rounded-lg border border-slate-800/50">
                                {stage.description}
                            </p>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <Database size={12} /> TARGET MONSTERS (TABLE DATA)
                                </p>
                                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700 font-mono text-xs">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-indigo-400 border-b border-slate-700">
                                                {Object.keys(stage.initialData[0]).map(k => <th key={k} className="pb-2">{k}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-300 divide-y divide-slate-800/50">
                                            {stage.initialData.map((d, i) => (
                                                <tr key={i} className="hover:bg-slate-800/50">
                                                    {Object.values(d).map((v, j) => <td key={j} className="py-1.5">{v}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border-2 border-indigo-900/40 p-5 rounded-xl relative shadow-[0_0_20px_rgba(79,70,229,0.1)]">
                        <div className="absolute -top-3 -left-3 bg-indigo-900 border-2 border-indigo-400 rounded-full p-2 shadow-lg">
                            <Sparkles size={16} className="text-indigo-200" />
                        </div>
                        <h4 className="font-serif font-bold text-indigo-300 mb-2 ml-4 flex items-center gap-2">
                            猫仙人の助言
                        </h4>
                        <div className="text-xs text-slate-300 font-mono leading-relaxed min-h-[60px] bg-black/50 p-3 rounded border border-slate-800">
                            {aiAdvice ? (
                                <span className="animate-in fade-in duration-700">{aiAdvice}</span>
                            ) : (
                                <span className="text-slate-600">呪文を詠唱し、行き詰まったらワシを呼ぶのニャ...</span>
                            )}
                        </div>
                        {aiAdvice && (
                            <button
                                onClick={() => speakText(aiAdvice)}
                                className="mt-3 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                                <Volume2 size={12} /> 声を聞く
                            </button>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-[#0f111a] rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px] tracking-widest uppercase">
                                <BookOpen size={14} className="text-indigo-500" />
                                Grimoire - SPELL EDITOR
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={fixMySql}
                                    disabled={isFixing || !sqlInput}
                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-3 py-1 rounded text-[10px] font-mono transition-all flex items-center gap-1"
                                >
                                    {isFixing ? <Loader2 size={12} className="animate-spin" /> : <Eraser size={12} />}
                                    自動修復
                                </button>
                                <button
                                    onClick={getAiAdvice}
                                    disabled={isAiLoading || !sqlInput}
                                    className="bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 px-3 py-1 rounded text-[10px] font-mono transition-all"
                                >
                                    助言を乞う
                                </button>
                            </div>
                        </div>

                        <div className="p-6 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-900/50 border-r border-slate-800 flex flex-col items-center pt-6 text-slate-700 font-mono text-xs select-none">
                                1<br />2<br />3<br />4
                            </div>
                            <textarea
                                value={sqlInput}
                                onChange={(e) => setSqlInput(e.target.value)}
                                placeholder="-- ここに呪文（SQL）を刻み込め..."
                                className="w-full h-32 pl-6 bg-transparent text-emerald-400 font-mono text-lg outline-none resize-none placeholder:text-slate-700 caret-fuchsia-500"
                                spellCheck="false"
                            />

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleRun}
                                    disabled={isCasting}
                                    className={`
                    relative group overflow-hidden font-bold text-sm tracking-widest uppercase px-8 py-3 rounded
                    ${isCasting ? 'bg-slate-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:translate-y-[2px] border-b-4 border-indigo-900 active:border-b-0'}
                    transition-all text-white
                  `}
                                >
                                    {isCasting ? (
                                        <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> 詠唱中...</span>
                                    ) : (
                                        <span className="flex items-center gap-2"><Zap size={18} /> CAST SPELL (実行)</span>
                                    )}
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1a1c29] border-2 border-slate-700 rounded-xl flex-1 min-h-[300px] flex flex-col relative overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCIvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDAsMCwwLDAuMikiLz4KPC9zdmc+')] opacity-50 z-10" />

                        <div className="px-4 py-2 bg-black/40 border-b border-slate-800 flex justify-between items-center z-20">
                            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2">
                                <Layout size={12} /> BATTLE RESULT / OUTPUT
                            </span>
                        </div>

                        <div className="flex-1 p-6 flex flex-col items-center justify-center z-20 relative">

                            {!result && !error && !isCasting && (
                                <div className="text-slate-600 text-center font-mono animate-pulse">
                                    <div className="w-16 h-16 mx-auto mb-4 border-2 border-slate-700 rounded-full flex items-center justify-center opacity-30">
                                        <Zap size={24} />
                                    </div>
                                    <p className="text-xs">呪文の詠唱を待機中...</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-rose-950/50 border border-rose-900 p-6 rounded-lg text-center animate-in zoom-in-95 max-w-md w-full backdrop-blur-sm">
                                    <ShieldAlert size={32} className="mx-auto mb-3 text-rose-500" />
                                    <p className="font-bold text-rose-400 font-serif mb-2 text-lg">SPELL FAILED!</p>
                                    <p className="text-xs text-rose-200/70 font-mono mb-4">{error}</p>
                                    <button onClick={getAiAdvice} className="text-[10px] font-bold bg-rose-900/50 hover:bg-rose-800 text-rose-200 px-4 py-2 rounded border border-rose-700 transition-colors">
                                        猫仙人に修復の助言を求める
                                    </button>
                                </div>
                            )}

                            {result && !error && (
                                <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-black/40 border border-slate-700 rounded-lg overflow-hidden backdrop-blur-sm">
                                        <table className="w-full text-left font-mono text-sm">
                                            <thead className="bg-slate-900">
                                                <tr>
                                                    {Object.keys(result[0]).map(k => (
                                                        <th key={k} className="px-6 py-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest border-b border-slate-700">{k}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50 text-slate-300">
                                                {result.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                        {Object.values(row).map((v, j) => (
                                                            <td key={j} className="px-6 py-3">{v}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {isSuccess && (
                                        <div className="mt-8 text-center animate-in zoom-in-95 duration-700 delay-300">
                                            <div className="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/30 px-6 py-1.5 rounded-full text-xs font-black mb-4 tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                                QUEST CLEARED!
                                            </div>
                                            <p className="text-slate-300 font-serif text-sm mb-6 bg-slate-900/80 p-4 rounded-lg inline-block border border-slate-700">
                                                {stage.explanation}
                                            </p>
                                            <br />
                                            <button
                                                onClick={nextStage}
                                                className="bg-amber-600 hover:bg-amber-500 text-black px-8 py-3 rounded text-sm font-black tracking-widest transition-all active:translate-y-[2px] border-b-4 border-amber-900 active:border-b-0 flex items-center justify-center gap-2 mx-auto"
                                            >
                                                {currentStageIdx < stages.length - 1 ? "次の階層へ進む" : "伝説の勇者（全クリア）"}
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
