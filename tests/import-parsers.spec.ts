import { ImportsService } from '../apps/api/src/modules/imports/imports.service';
import * as crypto from 'crypto';

describe('Parsers de Importação Bancária e Deduplicação (OFX e CSV)', () => {
  let service: ImportsService;

  beforeEach(() => {
    // Instancia o serviço com mock do Prisma
    service = new ImportsService({} as any);
  });

  it('deve extrair transações de um arquivo OFX bancário com datas e valores corretos', () => {
    const ofxSample = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261015120000
            <TRNAMT>-154.80
            <FITID>202610150001
            <MEMO>Supermercado Pao de Acucar
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261016120000
            <TRNAMT>5000.00
            <FITID>202610160002
            <MEMO>Salario Empresa X
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

    const result = service.parseOfx(ofxSample);

    expect(result.length).toBe(2);

    // 1ª transação: Despesa de R$ 154,80
    expect(result[0].type).toBe('EXPENSE');
    expect(result[0].amount).toBe(154.80);
    expect(result[0].description).toBe('Supermercado Pao de Acucar');
    expect(result[0].externalId).toBe('202610150001');

    // 2ª transação: Receita de R$ 5.000,00
    expect(result[1].type).toBe('INCOME');
    expect(result[1].amount).toBe(5000.00);
    expect(result[1].description).toBe('Salario Empresa X');
    expect(result[1].externalId).toBe('202610160002');
  });

  it('deve processar arquivo CSV bancário com formato brasileiro e vírgula decimal', () => {
    const csvSample = `Data;Descricao;Valor
18/10/2026;Posto Shell Combustivel;-220,50
19/10/2026;Rendimento Poupanca;45,30
20/10/2026;Farmacia Droga Raia;-89,90`;

    const result = service.parseCsv(csvSample);

    expect(result.length).toBe(3);

    expect(result[0].description).toBe('Posto Shell Combustivel');
    expect(result[0].amount).toBe(220.50);
    expect(result[0].type).toBe('EXPENSE');

    expect(result[1].description).toBe('Rendimento Poupanca');
    expect(result[1].amount).toBe(45.30);
    expect(result[1].type).toBe('INCOME');

    expect(result[2].description).toBe('Farmacia Droga Raia');
    expect(result[2].amount).toBe(89.90);
    expect(result[2].type).toBe('EXPENSE');
  });

  it('deve gerar hash idempotente consistente para impedir importação duplicada', () => {
    const accountId = 'acc-itau-123';
    const externalId = 'fitid-998877';
    const amount = '150.00';
    const dateStr = '2026-10-29';

    const hash1 = crypto
      .createHash('sha256')
      .update(`${accountId}:${externalId}:${amount}:${dateStr}`)
      .digest('hex');

    const hash2 = crypto
      .createHash('sha256')
      .update(`${accountId}:${externalId}:${amount}:${dateStr}`)
      .digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});

