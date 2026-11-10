export class DocumentValidator {
  static validateCpf(value: string): boolean {
    const cpf = value.replaceAll(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number.parseInt(cpf[i]) * (10 - i);
    let remainder = sum % 11;
    const d1 = remainder < 2 ? 0 : 11 - remainder;
    if (Number.parseInt(cpf[9]) !== d1) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += Number.parseInt(cpf[i]) * (11 - i);
    remainder = sum % 11;
    const d2 = remainder < 2 ? 0 : 11 - remainder;
    return Number.parseInt(cpf[10]) === d2;
  }
}
