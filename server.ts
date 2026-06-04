import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json());

// API Endpoints
app.post("/api/assistant", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Mensagem é obrigatória." });
    }

    // Set up chat session instructions
    const systemInstruction = `Você é o Assistente Virtual Oficial do GuiaEstudantil de Curitiba e Região Metropolitana.
Sua missão é auxiliar estudantes em dúvidas de nível técnico, tecnólogo e superior em Curitiba.
Responda de forma clara, prestativa e objetiva, simulando um consultor de carreira e vestibular governamental.
Sempre mencione instituições de Curitiba e região (como UFPR, UTFPR, PUCPR, IFPR, Universidade Positivo, UniAndrade, FAP, etc.) quando apropriado.
Seja técnico e acolhedor. Responda em português. Formate as saídas em Markdown limpo, usando negrito, subtítulos e listas para facilitar a leitura.`;

    // Reconstruct full conversation from history if provided, or run generateContent
    const prompt = message;
    
    // In order to be robust and keep a clean structure, we use the simple chats or contents list.
    // If we have history, we can format them as contents, otherwise just pass the prompt.
    let contents: any[] = [];
    if (history && Array.isArray(history)) {
      contents = history.map((item: any) => ({
        role: item.role === "user" ? "user" : "model",
        parts: [{ text: item.text }],
      }));
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    const text = response.text || "Desculpe, não consegui processar sua resposta no momento.";
    res.json({ text });
  } catch (error: any) {
    console.error("Erro no assistente Gemini:", error);
    res.status(500).json({
      error: "Ocorreu um erro ao processar sua pergunta. Verifique se o GEMINI_API_KEY está configurado corretamento nos Secrets.",
    });
  }
});

// Mock/Example data for Curitiba institutions, announcements and careers to feed the frontend instantly if required
app.get("/api/data/institutions", (req, res) => {
  res.json([
    {
      id: "ufpr",
      name: "UFPR - Universidade Federal do Paraná",
      type: "Pública Federal",
      campus: ["Centro", "Politécnico", "Rebouças", "Cabral", "Palotina", "Matinhos", "Jandaia do Sul"],
      website: "https://www.ufpr.br",
      description: "A mais antiga universidade do Brasil, referência em pesquisa, ensino e extensão.",
      highlights: "Vestibular próprio concorrido, SISU, isenções para estudantes de escola pública com baixa renda.",
      logo: "🏛️"
    },
    {
      id: "utfpr",
      name: "UTFPR - Universidade Tecnológica Federal do Paraná",
      type: "Pública Federal",
      campus: ["Curitiba (Centro / Ecoville / Neoville)"],
      website: "https://www.utfpr.edu.br",
      description: "Foco tecnológico e profissional, originada do antigo CEFET-PR. Excelente infraestrutura de laboratórios.",
      highlights: "Seleção via SISU (Exame Nacional do Ensino Médio - ENEM). Alta empregabilidade na área de engenharia e TI.",
      logo: "💻"
    },
    {
      id: "ifpr",
      name: "IFPR - Instituto Federal do Paraná",
      type: "Pública Federal",
      campus: ["Curitiba (Ecoville) e Região Metropolitana (Pinhais, Colombo, Campo Largo)"],
      website: "https://ifpr.edu.br",
      description: "Ensino médio integrado, cursos técnicos subsequentes e nível superior tecnológico.",
      highlights: "Vestibular próprio com taxa de inscrição acessível. Excelente para cursos técnicos de informática e administração.",
      logo: "🛠️"
    },
    {
      id: "pucpr",
      name: "PUCPR - Pontifícia Universidade Católica do Paraná",
      type: "Privada Comunitária",
      campus: ["Prado Velho"],
      website: "https://www.pucpr.br",
      description: "Uma das melhores universidades privadas do país, com forte ligação internacional e campus dinâmico.",
      highlights: "ProUni, Crédito Universitário (Fundacred), vestibular agendado e nota do ENEM.",
      logo: "⛪"
    },
    {
      id: "positivo",
      name: "Universidade Positivo - UP",
      type: "Privada",
      campus: ["Campo Comprido", "Santos Andrade", "Praça Osório"],
      website: "https://www.up.edu.br",
      description: "Reconhecida pela qualidade do campus Ecoville e forte atuação na área de economia Criativa, Saúde e Negócios.",
      highlights: "Bolsas de desempenho, vestibular online e seleção simplificada via ENEM.",
      logo: "☀️"
    },
    {
      id: "unespar",
      name: "UNESPAR - Campus de Curitiba (FAP e EMBAP)",
      type: "Pública Estadual",
      campus: ["Curitiba (FAP - Cabral / EMBAP - Centro)"],
      website: "http://www.unespar.edu.br",
      description: "Focada em artes, música, cinema, teatro e design, unindo a Faculdade de Artes do Paraná e a Escola de Música e Belas Artes.",
      highlights: "Vestibular próprio estadual e SISU, taxa reduzida para inscritos no CadÚnico.",
      logo: "🎨"
    }
  ]);
});

// Start server and mount Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware carregado com sucesso.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Porta de escuta do servidor GuiaEstudantil: http://localhost:${PORT}`);
  });
}

startServer();
