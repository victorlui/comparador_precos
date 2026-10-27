export type ScanProductPayload = {
  imageUri: string;
};

export type SearchProductPayload = {
  query: string;
};

export type ScanProductResponse = {
  status?: string;
  message?: string;
  produto?: string;
  produto_principal?: string;
  candidatos?: string[];
  precos?: {
    loja: string;
    titulo?: string;
    preco: string;
    link: string;
    frete?: string;
    imagem?: string;
  }[];
};
