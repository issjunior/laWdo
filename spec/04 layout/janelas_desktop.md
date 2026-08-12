# Persistência de janelas desktop

## Fonte de verdade e ciclo

A janela principal é criada em `src/main/index.ts`. O estado local `janela_principal_estado`, na tabela `configuracoes`, é administrado por `src/main/utils/estado-janela-principal.ts`. Ele é salvo com debounce de 300 ms em mover, redimensionar, maximizar, restaurar e no fechamento. Falha de leitura, JSON inválido ou falha de gravação é registrada e não impede a abertura.

O formato ativo é versão 2:

```json
{
  "versao": 2,
  "x": 600, "y": 100, "largura": 1200, "altura": 800,
  "monitorId": 1,
  "areaMonitor": { "x": 0, "y": 0, "largura": 1920, "altura": 1040 },
  "escalaMonitor": 1,
  "maximizada": false
}
```

Ao maximizar, os limites normais são preservados para que restaurar a janela mantenha o tamanho anterior. O estado legado versão 1, sem área e escala do monitor, continua aceito e recebe a normalização absoluta anterior.

## Restauração adaptativa

Com o mesmo `monitorId`, área útil e escala, a janela recupera posição e tamanho absolutos. Quando o monitor não existe ou sua área útil/escala mudou, largura, altura e deslocamento são recalculados proporcionalmente na área útil do monitor escolhido. A escolha prefere o monitor pelo ID, depois pelo ponto salvo e por fim o principal.

Toda restauração limita tamanho a 90% da área útil e aplica mínimos de 1024 x 768, limitando também posição à região visível. Assim, dados vindos de JSON, backup ou uma configuração de outro arranjo de monitores não deixam a janela inacessível. Os limites mínimos podem exceder monitores menores; nesse caso a própria restrição mínima da aplicação prevalece.

O estado é específico do dispositivo, mas pode acompanhar backups por estar em `configuracoes`; a normalização v2 existe justamente para essa portabilidade parcial. Testes em `src/__tests__/main/estado-janela-principal.test.ts` cobrem manutenção absoluta no monitor compatível e transformação proporcional quando o monitor salvo não está disponível.
