provider "aws" {
  region = "us-east-1"
}

resource "aws_ecs_cluster" "latif" {
  name = "latif-cluster"
}

resource "aws_ecs_service" "latif" {
  name            = "latif-service"
  cluster         = aws_ecs_cluster.latif.id
  task_definition = aws_ecs_task_definition.latif.arn
  desired_count   = 3
}
