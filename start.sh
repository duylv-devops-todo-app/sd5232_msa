#!/bin/bash
kubectl config set-context --current --namespace eks-ns-1

kubectl apply -f mongodb.yaml
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0-beta.0/deploy/static/provider/aws/deploy.yaml
kubectl get pods --namespace=ingress-nginx | grep nginx
kubectl apply -f ingress.yml
kubectl get ingress -o wide

kubectl get pods -n ingress-nginx

kubectl logs -f ingress-nginx-controller-7fb8b84675-csbsw -n ingress-nginx
kubectl logs -f ingress-nginx-controller-7fb8b84675-bxd48 -n ingress-nginx
kubectl logs -f pod/ingress-nginx-controller-5c6f9fcb57-b8wxs -n ingress-nginx

git clone https://github.com/duylv-devops-todo-app/sd5232_msa.git