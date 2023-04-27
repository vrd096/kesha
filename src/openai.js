import { Configuration, OpenAIApi } from 'openai';
import config from 'config';
import { createReadStream } from 'fs';
import { removeFile } from './utils.js';

const roles = {
  ASSISTANT: 'assistant',
  USER: 'user',
  SYSTEM: 'system',
};

const openai = (apiKey) => {
  const configuration = new Configuration({
    apiKey,
  });
  const openai = new OpenAIApi(configuration);

  const chat = async (messages) => {
    try {
      const completionPromise = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages,
      });
      const timeoutPromise = new Promise((resolve, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 80000),
      );
      const completion = await Promise.race([completionPromise, timeoutPromise]);
      const response = completion.data.choices[0].message.content;
      return response;
    } catch (error) {
      console.log(error.message);
    }
  };

  const transcription = async (filepath) => {
    try {
      const response = await openai.createTranscription(createReadStream(filepath), 'whisper-1');

      const text = response.data.text;
      if (text) {
        await removeFile(filepath);
      }

      return text;
    } catch (error) {
      console.log(error.message);
    }
  };

  return { roles, chat, transcription };
};

export const openaiGPT = openai(config.get('OPENAI_KEY'));
