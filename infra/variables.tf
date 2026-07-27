variable "project" {
  description = "Prefijo aplicado al nombre de todos los recursos."
  type        = string
  default     = "payment-checkout"
}

variable "aws_region" {
  description = "Región donde se crean la Lambda y el bucket."
  type        = string
  default     = "us-east-1"
}

variable "lambda_url_auth_type" {
  description = <<-EOT
    Autorización de la Lambda Function URL. AWS_IAM es lo deseable: la URL solo
    acepta peticiones firmadas por CloudFront. NONE la deja accesible por su URL
    directa y solo debería usarse para diagnosticar.
  EOT
  type        = string
  default     = "AWS_IAM"

  validation {
    condition     = contains(["AWS_IAM", "NONE"], var.lambda_url_auth_type)
    error_message = "Debe ser AWS_IAM o NONE."
  }
}

variable "cors_origins" {
  description = <<-EOT
    Orígenes permitidos por CORS, separados por coma. Vacío por defecto: el SPA y la
    API viven bajo el mismo dominio de CloudFront, así que el navegador nunca hace
    una petición cross-origin. Solo hace falta llenarlo para apuntar un frontend
    local contra esta API.
  EOT
  type        = string
  default     = ""
}

variable "database_url" {
  description = "Cadena de conexión de PostgreSQL."
  type        = string
  sensitive   = true
}

variable "payment_gateway_base_url" {
  description = "URL base del ambiente sandbox de la pasarela."
  type        = string
}

variable "payment_gateway_public_key" {
  description = "Llave pública de la pasarela (tokenización desde el navegador)."
  type        = string
}

variable "payment_gateway_private_key" {
  description = "Llave privada de la pasarela (creación del cobro)."
  type        = string
  sensitive   = true
}

variable "payment_gateway_integrity_key" {
  description = "Secreto para firmar el monto y la referencia."
  type        = string
  sensitive   = true
}

variable "payment_gateway_events_key" {
  description = "Secreto para verificar la firma de los webhooks."
  type        = string
  sensitive   = true
}

variable "base_fee_cents" {
  description = "Comisión base aplicada a toda orden, en centavos."
  type        = number
  default     = 500000
}

variable "delivery_fee_cents" {
  description = "Costo de envío, en centavos."
  type        = number
  default     = 1000000
}

variable "lambda_memory_mb" {
  description = "Memoria de la Lambda. Más memoria también da más CPU, lo que acorta el arranque en frío."
  type        = number
  default     = 1024
}

variable "lambda_timeout_seconds" {
  description = "Timeout de la Lambda. Debe superar el timeout que la API usa contra la pasarela."
  type        = number
  default     = 30
}
