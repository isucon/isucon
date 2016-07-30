# install

```bash
brew install ansible
```

# run

## ぜんぶ

```bash
ansible-playbook -i hosts playbook.yaml
```

## nginx

```bash
ansible-playbook -i hosts playbook.yaml --tags nginx
```

## mysql

```bash
ansible-playbook -i hosts playbook.yaml --tags mysql
```

## supervisor

```bash
ansible-playbook -i hosts playbook.yaml --tags supervisor
```
