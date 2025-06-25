#Desarrollo 
docker build --target dev -t tailadmin-dev -f Dockerfile .
docker run -p 5173:5173 tailadmin-dev

#producción
docker build --target production -t tailadmin-prod -f Dockerfile .
docker run -p 8888:80 tailadmin-prod
