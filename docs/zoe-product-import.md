# Importação de pesquisa da Zoe

Use o schema abaixo para entregar pesquisas estruturadas ao CasaPrática. Não edite campos que você não conhece. Use `null`.

```json
{
  "schema": "casapratica_product_import_v1",
  "generatedAt": "2026-09-06T18:00:00.000Z",
  "source": "ZOE_WEB_RESEARCH",
  "products": [
    {
      "title": "Organizador de cozinha",
      "productUrl": "https://produto.example/produto-123",
      "affiliateUrl": null,
      "imageUrl": "https://produto.example/imagem-123.jpg",
      "category": "cozinha",
      "price": 79.9,
      "currency": "BRL",
      "rating": 4.8,
      "reviewCount": 320,
      "sales": 10000,
      "salesEvidence": "PUBLIC_VISIBLE_TEXT",
      "sellerName": "Loja Exemplo",
      "sellerReputation": "98%",
      "officialStore": true,
      "mercadoLider": null,
      "bestSeller": true,
      "freeShipping": true,
      "sourceObservedAt": "2026-09-06T17:30:00.000Z",
      "sourceNotes": "Dados visíveis na página pública.",
      "evidence": {
        "price": "VISIBLE_PUBLIC_DATA",
        "rating": "VISIBLE_PUBLIC_DATA",
        "sales": "PUBLIC_VISIBLE_TEXT",
        "seller": "VISIBLE_PUBLIC_DATA"
      }
    }
  ]
}
```

O pacote aceita até 50 produtos. URLs devem ser HTTPS públicas. Dados com mais de 72 horas são marcados como obsoletos e o preço deixa de ser tratado como atual.
