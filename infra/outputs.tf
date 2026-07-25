output "app_url" {
  description = "URL pública del SPA."
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "api_url" {
  description = "URL base de la API."
  value       = "https://${aws_cloudfront_distribution.app.domain_name}/api/v1"
}

output "swagger_url" {
  description = "Documentación interactiva de la API."
  value       = "https://${aws_cloudfront_distribution.app.domain_name}/docs"
}

output "spa_bucket" {
  description = "Bucket donde se sincroniza el build del SPA."
  value       = aws_s3_bucket.spa.id
}

output "distribution_id" {
  description = "Distribución de CloudFront, necesaria para invalidar la caché."
  value       = aws_cloudfront_distribution.app.id
}

output "lambda_name" {
  description = "Nombre de la función Lambda que sirve la API."
  value       = aws_lambda_function.api.function_name
}
