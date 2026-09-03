# Domínio

A CasaPrática pesquisa, compara, seleciona e recomenda produtos para casa; cria conteúdo e criativos; publica mediante aprovação; mede resultados reais; e aprende.

Ela não fabrica, vende, entrega ou oferece garantia. Preço, vendedor, reputação, avaliações, comissão e métricas externas são fatos opcionais provenientes de fontes verificáveis. Ausência é representada como ausência, nunca preenchida por estimativa.

Toda decisão pondera benefício ao consumidor, potencial comercial e fortalecimento da marca. Confiança tem prioridade sobre comissão.

## Produto e publicação

Produtos percorrem `candidate → under_review → approved` antes de teste ou ativação. Publicações não podem avançar de rascunho para publicação sem passar por aprovação. Transições inválidas são rejeitadas pelo domínio.

Fatos externos desconhecidos permanecem `null`. Zero é um valor observado e nunca representa ausência.

## Score CasaPrática

O score pondera demanda (25), avaliações (25), reputação do vendedor (15), competitividade de preço (15), qualidade do anúncio/visual (10), comissão (5) e sazonalidade (5). O cálculo é normalizado apenas pelo peso dos fatores disponíveis. A confiança corresponde à fração do peso total que possui evidência, e fatores ausentes são explicitados no resultado.

## Categorias iniciais

Organização, Cozinha, Banheiro, Quarto, Sala, Lavanderia, Limpeza, Casa pequena, Decoração e Utilidades.
