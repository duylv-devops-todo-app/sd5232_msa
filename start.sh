#!/bin/bash
kubectl config set-context --current --namespace eks-ns-1

kubectl apply -f mongodb.yaml
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.7.1/deploy/static/provider/cloud/deploy.yaml
kubectl apply -f ingress.yml
# kubectl get pods --namespace=ingress-nginx | grep nginx
kubectl get ingress -o wide