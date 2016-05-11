FILENAME=$1
VIRTUAL_HOST=$2
VIRTUAL_HOST_CLEAN=`echo $VIRTUAL_HOST | sed -e 's/,//g'`
VIRTUAL_HOST_CLEAN=${VIRTUAL_HOST_CLEAN,,}
NODE_ENV=$3
DOCKERTAG=$4
LOGTAG=$5

echo Loading docker image
gunzip -c $FILENAME | docker load

echo Running docker image
PREVBUILD=`docker ps -q --filter label=name=$VIRTUAL_HOST_CLEAN`
CURRENTBUILD=`docker run -d --restart=on-failure:10 -v /home/ubuntu/config:/usr/src/app/server/config -v /home/ubuntu/cert:/usr/src/app/cert -e NODE_ENV=$NODE_ENV -e VIRTUAL_HOST=$VIRTUAL_HOST --log-driver syslog --log-opt tag="$LOGTAG" --label name=$VIRTUAL_HOST_CLEAN $DOCKERTAG`
echo Ran $CURRENTBUILD
sleep 2
docker stop $PREVBUILD 2>/dev/null && docker rm $PREVBUILD 2>/dev/null

echo Post deploy docker cleanup
docker rm `docker ps -aq --no-trunc --filter "status=exited"` 2>/dev/null
docker rmi `docker images --filter 'dangling=true' -q --no-trunc` 2>/dev/null
docker run -v /var/run/docker.sock:/var/run/docker.sock -v /var/lib/docker:/var/lib/docker --rm martin/docker-cleanup-volumes
