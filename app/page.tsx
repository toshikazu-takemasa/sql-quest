"use client";

import React, { useState, useEffect, useRef } from 'react';
import initSqlJs from 'sql.js';
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
    },
    {
        id: 3,
        title: "第三章: 序列の魔法『ORDER BY』",
        description: "兵士たちをHPの高い順に並び替えよ。秩序をもたらす呪文 ORDER BY の出番だニャ。",
        targetSql: "SELECT * FROM users ORDER BY hp DESC",
        initialData: [
            { id: 1, name: "見習い騎士", hp: 50 },
            { id: 2, name: "ベテラン兵士", hp: 150 },
            { id: 3, name: "近衛騎士", hp: 200 },
        ],
        hint: "ORDER BY hp DESC と書くと、大きい順（降順）になるのニャ。",
        explanation: "整然とした隊列だニャ！ ORDER BY はデータの海に秩序をもたらすのニャ。",
        imageUrl: null as string | null
    },
    {
        id: 4,
        title: "第四章: 召喚の制限『LIMIT』",
        description: "魔力が足りない！ 最も強い者、上位1名だけを召喚するのニャ。",
        targetSql: "SELECT * FROM users ORDER BY hp DESC LIMIT 1",
        initialData: [
            { id: 1, name: "一般兵", hp: 50 },
            { id: 2, name: "隊長", hp: 150 },
            { id: 3, name: "将軍", hp: 300 },
        ],
        hint: "LIMIT 1 を最後に付け足すのニャ。",
        explanation: "賢明な判断だニャ！ LIMIT を使えば、必要な分だけ魔力を節約できるのニャ。",
        imageUrl: null as string | null
    },
    {
        id: 5,
        title: "第五章: 統計の魔力『COUNT/SUM』",
        description: "軍勢の総数と、HPの合計値を算出せよ。数秘術の極意を見せるのニャ。",
        targetSql: "SELECT COUNT(*), SUM(hp) FROM users",
        initialData: [
            { id: 1, name: "歩兵", hp: 100 },
            { id: 2, name: "歩兵", hp: 100 },
            { id: 3, name: "歩兵", hp: 100 },
        ],
        hint: "COUNT(*) で数、SUM(hp) で合計が計算できるニャ。",
        explanation: "正確な計算だニャ！ 統計魔法は戦況を把握するために不可欠なのニャ。",
        imageUrl: null as string | null
    },
    {
        id: 6,
        title: "第六章: 同族の集結『GROUP BY』",
        description: "職種(job)ごとに、何人いるかを数えよ。散らばった魂を呼び集めるのニャ。",
        targetSql: "SELECT job, COUNT(*) FROM users GROUP BY job",
        initialData: [
            { id: 1, name: "アルス", job: "戦士" },
            { id: 2, name: "セリア", job: "魔法使い" },
            { id: 3, name: "ボルグ", job: "戦士" },
        ],
        hint: "GROUP BY job を使って、同じ職種をまとめるのニャ。",
        explanation: "見事にまとまったニャ！ GROUP BY は複雑な勢力を分析するのに役立つニャ。",
        imageUrl: null as string | null
    },
    {
        id: 7,
        title: "第七章: 世界の結合『JOIN』",
        description: "「users」と「items」という異なる世界の記録を繋げよ。装備者の名前とアイテム名を表示するのニャ。",
        targetSql: "SELECT users.name, items.item_name FROM users JOIN items ON users.id = items.user_id",
        initialData: [
            { id: 1, name: "勇者アルス" },
            { id: 2, name: "魔女セリア" }
        ],
        // 注意: JOINの場合は複数のテーブルデータを表示する必要があるが、一旦簡易化
        hint: "JOIN items ON users.id = items.user_id のように繋ぐのニャ。あ、itemsテーブルには {user_id: 1, item_name: '伝説の剣'} があるニャ。",
        explanation: "二つの世界が繋がったニャ！ JOINこそがSQLの真骨頂なのニャ。",
        imageUrl: null as string | null
    },
    {
        id: 8,
        title: "第八章: 新たな生命『INSERT』",
        description: "新たな仲間「猫の助」を名簿に加えるのニャ。生命を吹き込む INSERT の魔法だニャ。",
        targetSql: "INSERT INTO users (name, job) VALUES ('猫の助', '隠密')",
        initialData: [
            { id: 1, name: "勇者アルス", job: "戦士" }
        ],
        hint: "INSERT INTO users (name, job) VALUES ('名前', '職業') と書くのニャ。",
        explanation: "新たな風が吹いたニャ！ INSERT は世界に新たな存在を生み出す魔法なのニャ。",
        imageUrl: null as string | null
    },
    {
        id: 9,
        title: "第九章: 万物の変転『UPDATE』",
        description: "アルスのHPを最大値の999に書き換えるのニャ。運命を更新する UPDATE だニャ。",
        targetSql: "UPDATE users SET hp = 999 WHERE name = '勇者アルス'",
        initialData: [
            { id: 1, name: "勇者アルス", hp: 120 }
        ],
        hint: "UPDATE users SET hp = 999 WHERE ... という形だニャ。",
        explanation: "最強の勇者が誕生したニャ！ UPDATE は過去を塗り替える強力な魔法ニャ。",
        imageUrl: null as string | null
    },
    {
        id: 10,
        title: "最終章: 消滅の魔法『DELETE』",
        description: "邪悪な魔王を歴史から抹消せよ。全てを無に帰す究極の魔法 DELETE だニャ。",
        targetSql: "DELETE FROM users WHERE name = '魔王'",
        initialData: [
            { id: 1, name: "勇者アルス", job: "戦士" },
            { id: 99, name: "魔王", job: "諸悪の根源" }
        ],
        hint: "DELETE FROM users WHERE name = '魔王' と念じるのニャ。",
        explanation: "世界に平和が訪れたニャ...。君は立派なSQLマスターになったのニャ！",
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
    const [SQL, setSQL] = useState<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        initSqlJs({
            locateFile: file => `/sql-wasm.wasm`
        }).then(sql => {
            setSQL(sql);
        }).catch(err => {
            console.error("Failed to load sql.js:", err);
            setError("SQLエンジンの初期化に失敗しました。ページを再読み込みしてください。");
        });
    }, []);

    const stage = stages[currentStageIdx];

    const handleRun = () => {
        if (!SQL) {
            setError("SQLエンジンの初期化を待っているニャ...");
            return;
        }

        setIsCasting(true);
        setError("");
        setResult(null);
        setIsSuccess(false);

        setTimeout(() => {
            setIsCasting(false);
            try {
                const tempDb = new SQL.Database();

                // テーブル作成とデータ投入
                const columns = Object.keys(stage.initialData[0]);
                const createTableSql = `CREATE TABLE users (${columns.map(c => `${c} TEXT`).join(', ')});`;
                tempDb.run(createTableSql);

                stage.initialData.forEach((row: any) => {
                    const keys = Object.keys(row);
                    const values = Object.values(row).map(v => typeof v === 'string' ? `'${v}'` : v);
                    tempDb.run(`INSERT INTO users (${keys.join(', ')}) VALUES (${values.join(', ')});`);
                });

                // 第七章（JOIN）のための特別処理: itemsテーブルの作成
                if (stage.id === 7) {
                    tempDb.run("CREATE TABLE items (user_id INTEGER, item_name TEXT);");
                    tempDb.run("INSERT INTO items (user_id, item_name) VALUES (1, '伝説の聖剣');");
                    tempDb.run("INSERT INTO items (user_id, item_name) VALUES (2, '賢者の杖');");
                }

                // ユーザーのSQL実行
                const res = tempDb.exec(sqlInput);

                if (res.length > 0) {
                    const columns = res[0].columns;
                    const values = res[0].values;
                    const formattedResult = values.map(row => {
                        const obj: any = {};
                        columns.forEach((col, i) => obj[col] = row[i]);
                        return obj;
                    });
                    setResult(formattedResult);

                    // 成功判定 (簡易的に結果の内容や構造を比較)
                    // 本来は期待される結果セットと比較すべきだが、ここでは正規化してチェック
                    const normalizedInput = sqlInput.toLowerCase().trim().replace(/;/g, "");
                    const normalizedTarget = stage.targetSql.toLowerCase().trim().replace(/;/g, "");

                    if (normalizedInput === normalizedTarget) {
                        setIsSuccess(true);
                    } else {
                        // 構造的比較のロジックを入れることも可能
                        // 一旦完全一致または特定のキーワード判定に留める
                        if (formattedResult.length > 0) {
                            // クリア判定のロジック強化が必要な場合はここで行う
                            // 例: select name from users なら、columnsにnameがあり、件数が一致するか等
                        }
                    }
                } else {
                    setResult([]);
                    if (sqlInput.toLowerCase().includes("insert") || sqlInput.toLowerCase().includes("update") || sqlInput.toLowerCase().includes("delete")) {
                        // 変更を伴うSQLの場合は別途結果を確認する必要があるが、一旦成功フラグは立てない
                        setError("呪文は成功したようだが、何も召喚されなかったニャ。SELECTで確認するのニャ！");
                    }
                }

                tempDb.close();
            } catch (err: any) {
                setError(`詠唱エラー: ${err.message}だニャ！`);
                setIsSuccess(false);
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
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-x-hidden">
            <audio ref={audioRef} className="hidden" />

            {/* --- RPG Header --- */}
            <header className="max-w-[1600px] mx-auto mb-6">
                <div className="bg-slate-900/80 backdrop-blur-md border-2 border-indigo-900/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 border-2 border-indigo-400 p-2 rounded-lg text-white shadow-[0_0_15px_rgba(129,140,248,0.4)]">
                            <Swords size={28} className="drop-shadow-md" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-sm font-serif">
                                DATA<span className="text-indigo-400">QUEST</span>
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-[0.3em]">SQL Master RPG</span>
                                <div className="h-1 w-8 bg-indigo-500/30 rounded-full" />
                                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Sparkles size={10} /> {currentStageIdx === stages.length - 1 ? "伝説の勇者" : "SELECT見習い"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 max-w-xl mx-8 w-full">
                        <div className="flex justify-between text-[10px] font-mono mb-1.5 text-slate-400 uppercase tracking-tighter">
                            <span className="flex items-center gap-1"><Zap size={10} className="text-indigo-400" /> LV. {currentStageIdx + 1}</span>
                            <span>EXP: {currentStageIdx + 1} / {stages.length}</span>
                        </div>
                        <div className="h-4 bg-black/60 border border-slate-800 rounded-full overflow-hidden p-[2px] shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-fuchsia-500 rounded-full transition-all duration-1000 relative"
                                style={{ width: `${((currentStageIdx + 1) / stages.length) * 100}%` }}
                            >
                                <div className="absolute inset-0 bg-white/10 animate-pulse" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 border border-slate-800 p-1.5 rounded-lg">
                        <input
                            type="text"
                            placeholder="新ダンジョンのテーマ"
                            className="text-xs px-3 py-1.5 outline-none w-44 bg-transparent text-slate-300 font-mono placeholder:text-slate-600 border-r border-slate-800"
                            value={customTheme}
                            onChange={(e) => setCustomTheme(e.target.value)}
                        />
                        <button
                            onClick={generateCustomQuest}
                            disabled={isGeneratingQuest || !customTheme}
                            className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[10px] font-black px-4 py-1.5 rounded-md border border-indigo-500/30 transition-all flex items-center gap-1 uppercase tracking-widest"
                        >
                            {isGeneratingQuest ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                            生成
                        </button>
                    </div>
                </div>
            </header>

            {/* --- Main 3-Column Layout --- */}
            <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-160px)] min-h-[600px]">

                {/* 📜 Column 1: Quest Log (Left) */}
                <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
                    <div className="bg-[#1a1c29] border-2 border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col flex-1 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

                        {stage.imageUrl && (
                            <div className="relative h-32 flex-shrink-0 border-b-2 border-slate-900">
                                <img src={stage.imageUrl} alt="Quest Area" className="w-full h-full object-cover opacity-60" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c29] via-[#1a1c29]/40 to-transparent" />
                            </div>
                        )}

                        <div className="p-5 flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <Scroll size={18} />
                                    <span className="font-serif font-bold tracking-[0.15em] text-xs uppercase">Quest Log</span>
                                </div>
                                <button
                                    onClick={() => speakText(stage.description)}
                                    className={`p-1.5 rounded-md border transition-all ${isSpeaking ? 'bg-indigo-900 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Volume2 size={14} />
                                </button>
                            </div>

                            <h3 className="text-lg font-bold mb-3 font-serif text-white tracking-tight leading-tight">{stage.title}</h3>
                            <div className="text-[13px] text-slate-400 leading-relaxed mb-6 font-mono bg-black/40 p-4 rounded-lg border border-slate-800 shadow-inner italic">
                                "{stage.description}"
                            </div>

                            <div className="space-y-3 mt-auto">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Database size={10} /> Table: users
                                </p>
                                <div className="bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden">
                                    <table className="w-full text-left font-mono text-[10px]">
                                        <thead className="bg-slate-900/50">
                                            <tr className="text-indigo-400 border-b border-slate-800">
                                                {Object.keys(stage.initialData[0]).map(k => <th key={k} className="px-3 py-2 font-black">{k}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-400 divide-y divide-slate-800/30">
                                            {stage.initialData.map((d, i) => (
                                                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                    {Object.values(d).map((v, j) => <td key={j} className="px-3 py-1.5">{v}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border-2 border-indigo-900/30 p-4 rounded-xl relative shadow-lg">
                        <div className="absolute -top-3 -left-3 bg-indigo-900 border-2 border-indigo-500 rounded-full p-2 shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                            <Sparkles size={14} className="text-indigo-200" />
                        </div>
                        <h4 className="font-serif font-bold text-xs text-indigo-300 mb-2 ml-4 flex items-center gap-2 uppercase tracking-widest">
                            大賢者（猫仙人）
                        </h4>
                        <div className="text-[11px] text-slate-300 font-mono leading-relaxed min-h-[60px] bg-black/50 p-3 rounded border border-slate-800/50 relative overflow-hidden group">
                            <div className="absolute right-2 bottom-2 opacity-20 group-hover:opacity-40 transition-opacity">
                                <Database size={24} className="text-indigo-500" />
                            </div>
                            {aiAdvice ? (
                                <span className="animate-in fade-in duration-700">{aiAdvice}</span>
                            ) : (
                                <span className="text-slate-600 italic">呪文の構成に迷いがあるなら、ワシを呼ぶのニャ...</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ✨ Column 2: Grimoire (Center) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                    <div className="bg-[#0f111a] rounded-xl overflow-hidden shadow-2xl border-2 border-slate-800 flex flex-col flex-1 relative">
                        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/80 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <BookOpen size={16} className="text-indigo-500" />
                                <span className="text-slate-400 font-mono text-[10px] tracking-[0.3em] font-black uppercase">Grimoire - Editor</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={fixMySql}
                                    disabled={isFixing || !sqlInput}
                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5"
                                >
                                    {isFixing ? <Loader2 size={12} className="animate-spin" /> : <Eraser size={12} />}
                                    呪文修復
                                </button>
                                <button
                                    onClick={getAiAdvice}
                                    disabled={isAiLoading || !sqlInput}
                                    className="bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all"
                                >
                                    助言を乞う
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-0 relative flex flex-col">
                            <div className="absolute left-0 top-0 bottom-0 w-10 bg-black/20 border-r border-slate-800/50 flex flex-col items-center pt-6 text-slate-700 font-mono text-[10px] select-none space-y-2">
                                {Array.from({ length: 12 }).map((_, i) => <div key={i}>{i + 1}</div>)}
                            </div>
                            <textarea
                                value={sqlInput}
                                onChange={(e) => setSqlInput(e.target.value)}
                                placeholder="-- ここに呪文（SQL）を刻印せよ..."
                                className="w-full flex-1 pl-14 pr-6 py-6 bg-transparent text-emerald-400 font-mono text-lg outline-none resize-none placeholder:text-slate-800 caret-fuchsia-500 leading-relaxed custom-scrollbar"
                                spellCheck="false"
                            />

                            <div className="p-5 border-t border-slate-800/50 bg-black/20 flex items-center justify-between">
                                <div className="text-[10px] font-mono text-slate-600 bg-black/40 px-3 py-1.5 rounded-md border border-slate-800 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    MANA READY
                                </div>
                                <button
                                    onClick={handleRun}
                                    disabled={isCasting}
                                    className={`
                                        relative group overflow-hidden font-black text-xs tracking-[0.2em] uppercase px-10 py-4 rounded-lg
                                        ${isCasting ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1'}
                                        transition-all flex items-center gap-3
                                    `}
                                >
                                    {isCasting ? (
                                        <><Loader2 className="animate-spin" size={18} /> 詠唱中...</>
                                    ) : (
                                        <><Zap size={18} className="text-amber-400 group-hover:scale-110 transition-transform" /> CAST SPELL</>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 📊 Column 3: Battlefield (Right) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="bg-[#10121d] border-2 border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col flex-1 relative">
                        <div className="px-5 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-slate-400 font-mono text-[9px] tracking-[0.2em] font-black uppercase">
                                <Layout size={12} className="text-fuchsia-500" />
                                Battle Result
                            </div>
                            {result && (
                                <span className="text-[9px] font-mono text-slate-600">{result.length} ENTITIES</span>
                            )}
                        </div>

                        <div className="flex-1 p-5 flex flex-col relative overflow-y-auto custom-scrollbar">
                            {!result && !error && !isCasting && (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-700 font-mono animate-pulse">
                                    <div className="w-20 h-20 border-2 border-slate-800 rounded-full flex items-center justify-center mb-4 opacity-20">
                                        <Zap size={32} />
                                    </div>
                                    <p className="text-[10px] uppercase tracking-widest">Awaiting incantation...</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-rose-950/30 border-2 border-rose-900/50 p-6 rounded-xl text-center animate-in zoom-in-95 backdrop-blur-md">
                                    <ShieldAlert size={36} className="mx-auto mb-4 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                                    <p className="font-bold text-rose-400 font-serif mb-2 text-base uppercase tracking-widest">詠唱失敗！</p>
                                    <p className="text-[10px] text-rose-200/60 font-mono mb-6 leading-relaxed bg-black/30 p-3 rounded border border-rose-900/30">{error}</p>
                                    <button onClick={getAiAdvice} className="text-[9px] font-black bg-rose-900/40 hover:bg-rose-800 text-rose-200 px-5 py-2.5 rounded-lg border border-rose-700/50 transition-all uppercase tracking-widest shadow-lg">
                                        猫仙人の助けを借りる
                                    </button>
                                </div>
                            )}

                            {result && !error && (
                                <div className="w-full animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                                    <div className="bg-black/60 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                                        <table className="w-full text-left font-mono text-[11px]">
                                            <thead className="bg-slate-900">
                                                <tr>
                                                    {result.length > 0 && Object.keys(result[0]).map(k => (
                                                        <th key={k} className="px-4 py-3 text-[9px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-800">{k}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50 text-slate-300">
                                                {result.length > 0 ? result.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                                                        {Object.values(row).map((v: any, j) => (
                                                            <td key={j} className="px-4 py-2.5">{v}</td>
                                                        ))}
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td className="px-4 py-8 text-center text-slate-600 italic">No data summoned.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {isSuccess && (
                                        <div className="text-center animate-in zoom-in-95 duration-700 delay-300">
                                            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 px-5 py-2 rounded-full text-[10px] font-black mb-5 tracking-[0.2em] shadow-[0_0_20px_rgba(245,158,11,0.3)] uppercase">
                                                <CheckCircle2 size={12} /> Quest Cleared!
                                            </div>
                                            <div className="text-slate-200 font-serif text-[12px] leading-relaxed mb-8 bg-indigo-950/30 p-5 rounded-xl border border-indigo-800/40 shadow-xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-1 opacity-10"><Scroll size={40} /></div>
                                                {stage.explanation}
                                            </div>
                                            <button
                                                onClick={nextStage}
                                                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-black px-6 py-4 rounded-xl text-[11px] font-black tracking-[0.3em] transition-all active:translate-y-1 shadow-[0_10px_20px_rgba(245,158,11,0.2)] border-b-4 border-amber-900 active:border-b-0 flex items-center justify-center gap-3 uppercase"
                                            >
                                                {currentStageIdx < stages.length - 1 ? (
                                                    <>Next Floor <ChevronRight size={16} /></>
                                                ) : (
                                                    <>Victory <Sparkles size={16} /></>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(99, 102, 241, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(99, 102, 241, 0.4);
                }
            `}</style>
        </div>
    );
}
