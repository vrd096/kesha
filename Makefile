build: 
docker build -t bot-tg . 

run: 
docker run -d -p 3000:3000 --name bot-tg --rm bot-tg