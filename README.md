# Combate à Desinformação

Detector de fake news com contas (usuário, voluntário e administrador), revisão por voluntários e envio de fotos e vídeos para análise.

## Como as coisas funcionam

- **Detector (`/detector/`)**: o site manda só o texto para o servidor (`api/analyze.js`). A lista de palavras fica no servidor e não é enviada para o navegador. A resposta é uma previsão em porcentagem, sempre apresentada como estimativa. Passou de 25%, aparece o formulário configurado pelos administradores.
- **De onde vem a porcentagem**: cada palavra tem um histórico (quantas vezes foi vista em textos julgados falsos e verdadeiros pelos voluntários). A chance é a combinação desses históricos, com um pequeno ajuste para excesso de MAIÚSCULAS e de exclamações. O ponto de partida (15% para um texto sem sinais) é fixo no código (`PRIOR` em `api/analyze.js`). O número melhora conforme os voluntários revisam textos em `/moderar/`. Nunca é 0% nem 100%.
- **Contas**: login e cadastro passam pelo servidor (`api/conta.js`). A senha é transformada em hash (scrypt, com sal) e guardada no mesmo documento da pessoa, em `users`, junto com os campos `ehUsuario`, `ehVoluntario`, `ehAdmin`, `temFormulario` e outros. Depois de conferir a senha, o servidor entrega um token e o Firebase Authentication só mantém a sessão. Cinco senhas erradas bloqueiam a conta por 10 minutos.
- **Quem lê o documento da conta**: as regras deixam só a própria pessoa ler o seu documento. As telas de administração e de pedidos recebem os dados pelo servidor, sem o hash.
- **Voluntários**: toda conta nasce como usuário. Quem pede para ser voluntário aparece em `/moderar/` e em `/admin/` com os botões "Aceitar" e "Enviar formulário". O formulário aparece na tela do pedido no próximo login. Depois de enviado, vai para a revisão do administrador (aceitar ou recusar). No login seguinte, a pessoa vê "aceito", "recusado" ou o formulário.
- **Fotos e vídeos**: o arquivo vai para um repositório do GitHub, e o Firebase guarda só o registro. Tudo o mais (contas, textos, palavras, formulários) fica no Firebase.

## Configuração

### 1. Firebase
1. Crie o projeto e ative **Firestore Database** e **Authentication** (clique em "Começar"; não precisa ativar nenhum provedor de login).
2. Em Configurações do projeto, Seus apps, crie um app Web e cole os dados em `firebase-config.js`.
3. Em Firestore, Regras, cole o conteúdo de `firestore.rules`.
4. Em Contas de serviço, gere uma chave privada (arquivo `.json`) para a Vercel.

### 2. Repositório de mídias (GitHub)
1. Crie um repositório **privado** só para as fotos e vídeos.
2. Crie um token de acesso (fine-grained) com permissão de leitura e escrita de **Contents** apenas nesse repositório.

### 3. Vercel
- Framework Preset: `Other`. Build Command e Output Directory em branco.
- Variáveis de ambiente (veja `.env.example`): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GITHUB_TOKEN`, `GITHUB_MEDIA_REPO`, `GITHUB_MEDIA_BRANCH`.

### 4. Primeiro administrador
Crie uma conta normal em `/login/`. No Firestore, abra `users`, encontre o documento e mude `ehAdmin` para `true` (e `ehVoluntario` para `true`). Não existe botão no site para virar administrador. Depois disso, o admin cria e edita outras contas pelo painel.

### 5. Google
Troque `https://SEU-DOMINIO.vercel.app` pelo endereço real em `index.html`, `oquee/index.html`, `detector/index.html`, `robots.txt` e `sitemap.xml`, e envie o `sitemap.xml` no Google Search Console.

## Limites importantes
- **Tamanho dos arquivos: 3 MB.** A Vercel aceita no máximo cerca de 4,5 MB por envio, e o arquivo vai em base64. Vídeos longos não cabem nesse caminho.
- Cada envio vira um commit no repositório de mídias. Com muito uso o repositório cresce (o GitHub recomenda ficar abaixo de 1 GB).
