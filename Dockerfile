FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /App

# Install Node.js 20 (frontend is built via the .csproj NpmBuild MSBuild target)
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Restore layer caching
COPY nuget.config ./
COPY SetupDashboard.Api/SetupDashboard.Api.csproj SetupDashboard.Api/
RUN dotnet restore SetupDashboard.Api/SetupDashboard.Api.csproj

COPY . ./
RUN dotnet publish SetupDashboard.Api/SetupDashboard.Api.csproj -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
COPY --from=build-env /publish /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["dotnet", "SetupDashboard.Api.dll"]
