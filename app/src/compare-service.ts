import axios,{Axios} from 'axios';
const compareViaChatGPT = (originalWord: string, compareTargetList: string[]):Promise<boolean> => {
    compareTargetList.forEach(targetWord=>{
        axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "日本語で話してください"
                },
                {
                    role: "user",
                    content: `日本におけるゴミの出し方は自治体によって異なり、分類の名称も同じ 意味であったも異なる呼称が使われます。「${originalWord}」と「${targetWord}」という呼称がある時、この2つは同等のゴミを指していると思いますか？理由や根拠は述べずに「はい」か「いいえ」のみで答えてください。`
                }
            ]
        },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_TOKEN}`
                }
            }
        ).then(value=>{

        });
    });
}