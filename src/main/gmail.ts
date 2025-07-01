import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { BrowserWindow } from 'electron';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'resources/token.json';//path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = 'resources/credentials.json';//path.join(__dirname, 'credentials.json');


interface Credentials2 {
  installed?: {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export type Email = {
  from: string,
  subject: string,
  text: string,
  html?: string,
}

export async function lerEmails(): Promise<Email[]> {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) as Credentials2;
  const authClient = await authorize(credentials);
  return await listEmails(authClient);
}

async function authorizeGoogle(oAuth2Client): Promise<string>{
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
  
    const authWin = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    authWin.loadURL(authUrl);

  
    // intercepta o redirecionamento
    const { webRequest } = authWin.webContents.session;
    const filter = { urls: ['http://127.0.0.1:9999/callback*'] };
  
    return new Promise<string>((resolve, reject) => {
      webRequest.onBeforeRequest(filter, (details, callback) => {
        const url = new URL(details.url);
        const code = url.searchParams.get('code');
        authWin.close();
        // continue o fluxo, trocando code por token
        if (code) {
          resolve(code);
        } else {
          reject(new Error('Código de autorização não encontrado no redirecionamento.'));
        }
        callback({ cancel: true });
      });

      authWin.on('closed', () => {
        reject(new Error('Janela de autenticação fechada antes da conclusão.'));
      });
    });
  }

async function authorize(credentials: Credentials2): Promise<OAuth2Client> {
  const { client_id, client_secret, redirect_uris } = credentials.installed!;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Verifica se já existe token salvo
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  const code = await authorizeGoogle(oAuth2Client);
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  return oAuth2Client;
}

// Função auxiliar para decodificar o corpo do e-mail
function decodeGmailBody(part: any): string {
  if (part && part.body && part.body.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf8');
  }
  return '';
}

async function listEmails(auth: OAuth2Client): Promise<Email[]> {
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 20,
  });

  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    return [];
  }

  const results: Email[] = [];

  for (const message of messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: message.id!,
      format: 'full',
    });
    const headers = msg.data.payload?.headers || [];
    const subject = headers.find((h) => h.name === 'Subject')?.value ?? '(Sem assunto)';
    const from = headers.find((h) => h.name === 'From')?.value ?? '(Remetente desconhecido)';

    let textBody: string = '';
    let htmlBody: string = '';

    const findEmailParts = (parts: any[]) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain') {
          textBody = decodeGmailBody(part);
        } else if (part.mimeType === 'text/html') {
          htmlBody = decodeGmailBody(part);
        } else if (part.parts) {
          // Se for uma parte multipart, recursivamente procure em suas sub-partes
          findEmailParts(part.parts);
        }
      }
    };

    if (msg.data.payload?.parts) {
      // E-mail com múltiplas partes (ex: texto simples e HTML)
      findEmailParts(msg.data.payload.parts);
    } else if (msg.data.payload?.body) {
      // E-mail com corpo direto (sem partes)
      if (msg.data.payload.mimeType === 'text/plain') {
        textBody = decodeGmailBody(msg.data.payload);
      } else if (msg.data.payload.mimeType === 'text/html') {
        htmlBody = decodeGmailBody(msg.data.payload);
      }
    }

    results.push({
      from,
      subject,
      text: textBody || htmlBody.replace(/<[^>]*>?/gm, '') || '(Corpo do e-mail não disponível)', // Prioriza texto simples, depois HTML sem tags, senão padrão
      html: htmlBody // Opcional: Mantenha o HTML original se precisar
    });
  }

  return results;
}
