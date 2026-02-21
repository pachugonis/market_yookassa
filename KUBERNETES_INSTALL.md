# Kubernetes Installation Guide for Market YooKassa

Complete guide for deploying Market YooKassa on Kubernetes cluster with production-ready configuration.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- Kubernetes cluster (v1.24+)
- `kubectl` CLI tool installed and configured
- Minimum 3 worker nodes (2 vCPU, 4GB RAM each)
- Persistent storage provider (NFS, Ceph, or cloud provider)
- Ingress controller (Nginx, Traefik, or cloud provider)
- Domain name with DNS configured
- Helm 3.x (optional, for easier management)

### Tools Installation

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client

# Install Helm (optional)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

### Cluster Setup Options

**Option 1: Managed Kubernetes (Recommended for Production)**
- Google Kubernetes Engine (GKE)
- Amazon Elastic Kubernetes Service (EKS)
- Azure Kubernetes Service (AKS)
- DigitalOcean Kubernetes (DOKS)

**Option 2: Self-Hosted (Advanced Users)**
- kubeadm
- k3s (lightweight)
- RKE (Rancher Kubernetes Engine)

---

## Quick Start

For experienced Kubernetes users:

```bash
# Clone repository
git clone https://github.com/your-username/market-yookassa.git
cd market-yookassa/k8s

# Update configuration
./scripts/generate-secrets.sh
kubectl create namespace market-yookassa
kubectl apply -f secrets/
kubectl apply -f configmaps/
kubectl apply -f persistent-volumes/
kubectl apply -f deployments/
kubectl apply -f services/
kubectl apply -f ingress/

# Initialize database
kubectl exec -it deployment/market-app -n market-yookassa -- npx prisma db push
```

---

## Detailed Installation

### Step 1: Create Namespace

```bash
# Create dedicated namespace
kubectl create namespace market-yookassa

# Set as default namespace for convenience
kubectl config set-context --current --namespace=market-yookassa
```

### Step 2: Create Directory Structure

```bash
# Create Kubernetes manifests directory
mkdir -p k8s/{secrets,configmaps,persistent-volumes,deployments,services,ingress,scripts}
cd k8s
```

### Step 3: Create Secrets

#### Generate Secrets Script

Create `scripts/generate-secrets.sh`:

```bash
#!/bin/bash

# Generate random secrets
NEXTAUTH_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24)

# Create secrets directory
mkdir -p secrets

# Create secrets manifest
cat > secrets/app-secrets.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: market-secrets
  namespace: market-yookassa
type: Opaque
stringData:
  nextauth-secret: "${NEXTAUTH_SECRET}"
  db-password: "${DB_PASSWORD}"
  yookassa-shop-id: "YOUR_SHOP_ID"
  yookassa-secret-key: "YOUR_SECRET_KEY"
EOF

echo "Secrets generated successfully!"
echo "Please update YooKassa credentials in secrets/app-secrets.yaml"
```

```bash
# Make executable and run
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh

# Edit and add your YooKassa credentials
nano secrets/app-secrets.yaml
```

### Step 4: Create ConfigMaps

Create `configmaps/app-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: market-config
  namespace: market-yookassa
data:
  NEXTAUTH_URL: "https://yourdomain.com"
  NEXT_PUBLIC_BASE_URL: "https://yourdomain.com"
  UPLOAD_DIR: "uploads"
  NODE_ENV: "production"
  POSTGRES_DB: "market_yookassa"
  POSTGRES_USER: "marketuser"
```

### Step 5: Create Persistent Volumes

#### Storage Class (for cloud providers)

Create `persistent-volumes/storage-class.yaml`:

```yaml
# For local/self-hosted clusters
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: market-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer

---
# For cloud providers (example: AWS EBS)
# apiVersion: storage.k8s.io/v1
# kind: StorageClass
# metadata:
#   name: market-storage
# provisioner: kubernetes.io/aws-ebs
# parameters:
#   type: gp3
#   fsType: ext4
# volumeBindingMode: WaitForFirstConsumer

---
# For GCP (example: GCE PD)
# apiVersion: storage.k8s.io/v1
# kind: StorageClass
# metadata:
#   name: market-storage
# provisioner: kubernetes.io/gce-pd
# parameters:
#   type: pd-standard
#   fstype: ext4
```

#### Persistent Volume Claims

Create `persistent-volumes/pvcs.yaml`:

```yaml
# PostgreSQL Data PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: market-yookassa
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: market-storage
  resources:
    requests:
      storage: 20Gi

---
# Application Uploads PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-pvc
  namespace: market-yookassa
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: market-storage
  resources:
    requests:
      storage: 50Gi

---
# Public Assets PVC (avatars, covers, icons)
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: public-assets-pvc
  namespace: market-yookassa
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: market-storage
  resources:
    requests:
      storage: 20Gi
```

### Step 6: Create Database Deployment

Create `deployments/postgres-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: market-yookassa
  labels:
    app: postgres
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: market-secrets
              key: db-password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - marketuser
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - marketuser
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
```

### Step 7: Create Application Deployment

Create `deployments/app-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: market-app
  namespace: market-yookassa
  labels:
    app: market-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: market-app
  template:
    metadata:
      labels:
        app: market-app
    spec:
      initContainers:
      - name: wait-for-db
        image: busybox:1.36
        command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done;']
      containers:
      - name: app
        image: your-registry/market-yookassa:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: NODE_ENV
        - name: NEXTAUTH_URL
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: NEXTAUTH_URL
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: market-secrets
              key: nextauth-secret
        - name: NEXT_PUBLIC_BASE_URL
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: NEXT_PUBLIC_BASE_URL
        - name: YOOKASSA_SHOP_ID
          valueFrom:
            secretKeyRef:
              name: market-secrets
              key: yookassa-shop-id
        - name: YOOKASSA_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: market-secrets
              key: yookassa-secret-key
        - name: UPLOAD_DIR
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: UPLOAD_DIR
        - name: DATABASE_URL
          value: "postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@postgres:5432/$(POSTGRES_DB)?schema=public"
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: market-secrets
              key: db-password
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: market-config
              key: POSTGRES_DB
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
        - name: public-assets
          mountPath: /app/public/avatars
          subPath: avatars
        - name: public-assets
          mountPath: /app/public/covers
          subPath: covers
        - name: public-assets
          mountPath: /app/public/category-icons
          subPath: category-icons
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc
      - name: public-assets
        persistentVolumeClaim:
          claimName: public-assets-pvc
```

### Step 8: Create Services

Create `services/services.yaml`:

```yaml
# PostgreSQL Service
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: market-yookassa
  labels:
    app: postgres
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
    name: postgres
  selector:
    app: postgres

---
# Application Service
apiVersion: v1
kind: Service
metadata:
  name: market-app
  namespace: market-yookassa
  labels:
    app: market-app
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: market-app
  sessionAffinity: ClientIP
```

### Step 9: Create Ingress

Create `ingress/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: market-ingress
  namespace: market-yookassa
  annotations:
    # For nginx ingress controller
    nginx.ingress.kubernetes.io/proxy-body-size: "500m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    # For Let's Encrypt
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rps: "20"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
    secretName: market-tls-cert
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: market-app
            port:
              number: 80
  - host: www.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: market-app
            port:
              number: 80
```

### Step 10: Install Cert-Manager (for SSL)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager
```

Create `ingress/cert-issuer.yaml`:

```yaml
# Let's Encrypt Staging (for testing)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx

---
# Let's Encrypt Production
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Step 11: Create HorizontalPodAutoscaler

Create `deployments/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: market-app-hpa
  namespace: market-yookassa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: market-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
```

### Step 12: Build and Push Docker Image

Create `scripts/build-and-push.sh`:

```bash
#!/bin/bash

# Configuration
REGISTRY="your-registry.example.com"
IMAGE_NAME="market-yookassa"
VERSION=$(git rev-parse --short HEAD)
LATEST_TAG="${REGISTRY}/${IMAGE_NAME}:latest"
VERSION_TAG="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

# Build image
echo "Building Docker image..."
docker build -t ${LATEST_TAG} -t ${VERSION_TAG} -f Dockerfile .

# Push to registry
echo "Pushing to registry..."
docker push ${LATEST_TAG}
docker push ${VERSION_TAG}

echo "Image pushed: ${LATEST_TAG}"
echo "Image pushed: ${VERSION_TAG}"
```

```bash
# Make executable
chmod +x scripts/build-and-push.sh

# Build and push
./scripts/build-and-push.sh
```

---

## Configuration

### Update Image in Deployment

After building your image, update `deployments/app-deployment.yaml`:

```yaml
containers:
- name: app
  image: your-registry/market-yookassa:latest
  imagePullPolicy: Always
```

### Configure Image Pull Secrets (for private registries)

```bash
# Create Docker registry secret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.example.com \
  --docker-username=your-username \
  --docker-password=your-password \
  --docker-email=your-email@example.com \
  -n market-yookassa

# Add to deployment
# spec:
#   template:
#     spec:
#       imagePullSecrets:
#       - name: regcred
```

---

## Deployment

### Deploy All Resources

```bash
# Apply all manifests in order
kubectl apply -f secrets/
kubectl apply -f configmaps/
kubectl apply -f persistent-volumes/
kubectl apply -f deployments/postgres-deployment.yaml
kubectl apply -f services/services.yaml

# Wait for database to be ready
kubectl wait --for=condition=Ready pod -l app=postgres --timeout=300s

# Deploy application
kubectl apply -f deployments/app-deployment.yaml
kubectl apply -f deployments/hpa.yaml

# Wait for app to be ready
kubectl wait --for=condition=Ready pod -l app=market-app --timeout=300s

# Deploy ingress
kubectl apply -f ingress/cert-issuer.yaml
kubectl apply -f ingress/ingress.yaml
```

### Initialize Database

```bash
# Get app pod name
POD_NAME=$(kubectl get pod -l app=market-app -o jsonpath="{.items[0].metadata.name}")

# Run Prisma migrations
kubectl exec -it ${POD_NAME} -- npx prisma db push

# Seed database (optional)
kubectl exec -it ${POD_NAME} -- npm run db:seed
```

### Create Admin User

```bash
# Connect to PostgreSQL
kubectl exec -it deployment/postgres -- psql -U marketuser -d market_yookassa

# Update user role
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your-email@example.com';
\q
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n market-yookassa

# Check pods
kubectl get pods -n market-yookassa

# Check services
kubectl get svc -n market-yookassa

# Check ingress
kubectl get ingress -n market-yookassa

# Check certificate
kubectl get certificate -n market-yookassa
```

---

## Monitoring

### Install Metrics Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### View Resource Usage

```bash
# Node metrics
kubectl top nodes

# Pod metrics
kubectl top pods -n market-yookassa

# HPA status
kubectl get hpa -n market-yookassa
```

### View Logs

```bash
# Application logs
kubectl logs -f deployment/market-app -n market-yookassa

# Database logs
kubectl logs -f deployment/postgres -n market-yookassa

# All pods logs
kubectl logs -f -l app=market-app -n market-yookassa --max-log-requests=10

# Previous container logs
kubectl logs deployment/market-app -n market-yookassa --previous
```

### Install Kubernetes Dashboard (Optional)

```bash
# Install dashboard
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml

# Create admin user
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-user
  namespace: kubernetes-dashboard
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: admin-user
  namespace: kubernetes-dashboard
EOF

# Get token
kubectl -n kubernetes-dashboard create token admin-user

# Access dashboard
kubectl proxy
# Open: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

---

## Maintenance

### Backup Database

Create `scripts/backup.sh`:

```bash
#!/bin/bash

NAMESPACE="market-yookassa"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
POD_NAME=$(kubectl get pod -l app=postgres -n ${NAMESPACE} -o jsonpath="{.items[0].metadata.name}")

mkdir -p ${BACKUP_DIR}

# Backup database
kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
  pg_dump -U marketuser market_yookassa | \
  gzip > ${BACKUP_DIR}/db_${DATE}.sql.gz

echo "Backup completed: ${BACKUP_DIR}/db_${DATE}.sql.gz"

# Keep only last 7 days
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +7 -delete
```

### Restore Database

```bash
#!/bin/bash

NAMESPACE="market-yookassa"
BACKUP_FILE=$1
POD_NAME=$(kubectl get pod -l app=postgres -n ${NAMESPACE} -o jsonpath="{.items[0].metadata.name}")

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

gunzip < ${BACKUP_FILE} | \
  kubectl exec -i -n ${NAMESPACE} ${POD_NAME} -- \
  psql -U marketuser -d market_yookassa

echo "Restore completed"
```

### Update Application

```bash
# Build new image
./scripts/build-and-push.sh

# Rolling update
kubectl rollout restart deployment/market-app -n market-yookassa

# Check rollout status
kubectl rollout status deployment/market-app -n market-yookassa

# Check history
kubectl rollout history deployment/market-app -n market-yookassa

# Rollback if needed
kubectl rollout undo deployment/market-app -n market-yookassa
```

### Scale Application

```bash
# Manual scaling
kubectl scale deployment/market-app --replicas=5 -n market-yookassa

# Disable autoscaling
kubectl delete hpa market-app-hpa -n market-yookassa

# Enable autoscaling
kubectl apply -f deployments/hpa.yaml
```

### Update Secrets

```bash
# Update secret
kubectl edit secret market-secrets -n market-yookassa

# Or recreate
kubectl delete secret market-secrets -n market-yookassa
kubectl apply -f secrets/app-secrets.yaml

# Restart pods to apply changes
kubectl rollout restart deployment/market-app -n market-yookassa
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n market-yookassa

# Describe pod
kubectl describe pod <pod-name> -n market-yookassa

# Check events
kubectl get events -n market-yookassa --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n market-yookassa
```

### Database Connection Issues

```bash
# Check database pod
kubectl get pod -l app=postgres -n market-yookassa

# Test connection from app pod
kubectl exec -it deployment/market-app -n market-yookassa -- \
  sh -c 'nc -zv postgres 5432'

# Check database logs
kubectl logs deployment/postgres -n market-yookassa

# Verify environment variables
kubectl exec deployment/market-app -n market-yookassa -- env | grep DATABASE_URL
```

### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n market-yookassa
kubectl describe ingress market-ingress -n market-yookassa

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check certificate
kubectl get certificate -n market-yookassa
kubectl describe certificate market-tls-cert -n market-yookassa
```

### Storage Issues

```bash
# Check PVCs
kubectl get pvc -n market-yookassa

# Check PV
kubectl get pv

# Describe PVC
kubectl describe pvc uploads-pvc -n market-yookassa

# Check storage class
kubectl get storageclass
```

### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n market-yookassa
kubectl top nodes

# Check HPA status
kubectl get hpa -n market-yookassa

# Increase resources in deployment
kubectl edit deployment market-app -n market-yookassa
```

### Pod Crashes or CrashLoopBackOff

```bash
# Check pod logs
kubectl logs <pod-name> -n market-yookassa --previous

# Check pod events
kubectl describe pod <pod-name> -n market-yookassa

# Check liveness/readiness probes
kubectl get pod <pod-name> -n market-yookassa -o yaml

# Debug with temporary pod
kubectl run debug --image=busybox:1.36 -it --rm --restart=Never -n market-yookassa -- sh
```

### Network Issues

```bash
# Test service connectivity
kubectl run test --image=busybox:1.36 -it --rm --restart=Never -n market-yookassa -- \
  wget -O- http://market-app

# Check service endpoints
kubectl get endpoints -n market-yookassa

# Check network policies
kubectl get networkpolicy -n market-yookassa
```

---

## Advanced Configuration

### Redis Cache (Optional)

Create `deployments/redis-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: market-yookassa
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: market-yookassa
spec:
  ports:
  - port: 6379
  selector:
    app: redis
```

### Network Policies

Create `network-policies/network-policy.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: market-network-policy
  namespace: market-yookassa
spec:
  podSelector:
    matchLabels:
      app: market-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
```

### Resource Quotas

Create `resource-quotas/quota.yaml`:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: market-quota
  namespace: market-yookassa
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "10"
    services.loadbalancers: "1"
```

---

## Security Best Practices

1. **Use RBAC** - Implement role-based access control
2. **Network Policies** - Restrict pod-to-pod communication
3. **Pod Security Standards** - Enforce security contexts
4. **Secrets Management** - Use external secret stores (Vault, AWS Secrets Manager)
5. **Image Scanning** - Scan images for vulnerabilities
6. **Resource Limits** - Set CPU/memory limits for all containers
7. **Non-root Containers** - Run containers as non-root user
8. **Read-only Root Filesystem** - Mount root filesystem as read-only
9. **Regular Updates** - Keep Kubernetes and containers updated
10. **Audit Logging** - Enable and monitor audit logs

---

## Useful Commands

```bash
# Get all resources
kubectl get all -n market-yookassa

# Describe resource
kubectl describe deployment market-app -n market-yookassa

# Edit resource
kubectl edit deployment market-app -n market-yookassa

# Delete resource
kubectl delete deployment market-app -n market-yookassa

# Scale deployment
kubectl scale deployment market-app --replicas=5 -n market-yookassa

# Restart deployment
kubectl rollout restart deployment/market-app -n market-yookassa

# Port forward
kubectl port-forward service/market-app 3000:80 -n market-yookassa

# Execute command in pod
kubectl exec -it deployment/market-app -n market-yookassa -- sh

# Copy files
kubectl cp local-file.txt market-yookassa/pod-name:/app/file.txt

# Get pod shell
kubectl run debug --image=busybox -it --rm --restart=Never -n market-yookassa -- sh

# Apply all manifests
kubectl apply -f k8s/ -R

# Delete all resources
kubectl delete namespace market-yookassa
```

---

## Production Checklist

- [ ] Kubernetes cluster is properly configured
- [ ] Persistent storage is set up and tested
- [ ] Secrets are properly configured
- [ ] Database is initialized and tested
- [ ] SSL certificates are installed and valid
- [ ] Ingress controller is working
- [ ] Resource limits are set
- [ ] HPA is configured and tested
- [ ] Backups are automated
- [ ] Monitoring is set up
- [ ] Logs are being collected
- [ ] Network policies are in place
- [ ] RBAC is configured
- [ ] Admin user is created
- [ ] YooKassa integration is tested
- [ ] Application is accessible via domain
- [ ] Performance testing completed

---

## Getting Help

- Kubernetes docs: https://kubernetes.io/docs/
- kubectl cheat sheet: https://kubernetes.io/docs/reference/kubectl/cheatsheet/
- Troubleshooting: https://kubernetes.io/docs/tasks/debug/

---

**Deployment Complete!** Your Market YooKassa application is now running on Kubernetes cluster.

Access at: `https://yourdomain.com`
